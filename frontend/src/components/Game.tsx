import React, { Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { TextureLoader, Vector3 } from "three";
import * as THREE from "three";
import { create } from "zustand";

/* ──────────────────────────────────────────────────────────────────────────────
   ↑↑  CUSTOMISE SHOP PRICES HERE  ↑↑
   Each upgrade cost = BASE × (SCALING^current level).
   Making the game harder with smaller increments per upgrade for grinding.      */

// Attack upgrades
const ATTACK_COST_BASE = { damage: 20, range: 25, fireRate: 30 };
const ATTACK_COST_SCALING = { damage: 1.2, range: 1.3, fireRate: 1.2 };
const ATTACK_INCREMENT = { damage: 4, range: 0.2, fireRate: 50 };

// Defense upgrades
const DEFENSE_COST_BASE = { health: 30, regen: 50 };
const DEFENSE_COST_SCALING = { health: 1.25, regen: 1.3 };
const DEFENSE_INCREMENT = { health: 1, regen: 0.1 };

// Utility upgrades
const UTILITY_COST_BASE = { enemyReward: 40, waveBonus: 60 };
const UTILITY_COST_SCALING = { enemyReward: 1.3, waveBonus: 1.35 };
const UTILITY_INCREMENT = { enemyReward: 0.05, waveBonus: 0.1 };

/* ──────────────────────────────────────────────────────────────────────────── */

const calcCost = (category: string, stat: string, level: number) => {
  if (category === "attack") {
    return Math.round(
      ATTACK_COST_BASE[stat as keyof typeof ATTACK_COST_BASE] *
        Math.pow(
          ATTACK_COST_SCALING[stat as keyof typeof ATTACK_COST_SCALING],
          level
        )
    );
  } else if (category === "defense") {
    return Math.round(
      DEFENSE_COST_BASE[stat as keyof typeof DEFENSE_COST_BASE] *
        Math.pow(
          DEFENSE_COST_SCALING[stat as keyof typeof DEFENSE_COST_SCALING],
          level
        )
    );
  } else {
    // utility
    return Math.round(
      UTILITY_COST_BASE[stat as keyof typeof UTILITY_COST_BASE] *
        Math.pow(
          UTILITY_COST_SCALING[stat as keyof typeof UTILITY_COST_SCALING],
          level
        )
    );
  }
};

/* ---------- Enemy archetypes ------------------------------------------------ */
const ENEMY_TYPES = {
  normal: { color: "red", hpX: 1, speedX: 1, reward: 1 },
  fast: { color: "yellow", hpX: 0.7, speedX: 2, reward: 2 },
  tank: { color: "purple", hpX: 3, speedX: 0.5, reward: 5 },
  boss: { color: "black", hpX: 15, speedX: 0.3, reward: 20 },
  archer: { color: "green", hpX: 2, speedX: 1.2, reward: 3 }, // Ranged enemy
  protector: { color: "blue", hpX: 5, speedX: 0.7, reward: 5 }, // Shield enemy
} as const;
type EnemyKind = keyof typeof ENEMY_TYPES;

/* ---------- Zustand store --------------------------------------------------- */
interface Enemy {
  id: number;
  pos: Vector3;
  speed: number;
  hp: number;
  kind: EnemyKind;
  reward: number;
}
interface Projectile {
  id: number;
  pos: Vector3;
  dir: Vector3;
  speed: number;
  dmg: number;
}

interface Store {
  enemies: Enemy[];
  projectiles: Projectile[];
  coins: number;
  wave: number;

  // Tower stats
  towerHp: number;
  maxTowerHp: number;
  hpRegen: number;
  damage: number;
  range: number;
  fireRate: number;
  enemyRewardMult: number;
  waveRewardMult: number;

  // Internal tracking
  lastShot: number;
  dmgLvl: number;
  rngLvl: number;
  frLvl: number;
  hpLvl: number;
  regenLvl: number;
  enemyRewardLvl: number;
  waveRewardLvl: number;

  // Game timer
  gameTime: number;

  // Game speed (1x, 2x, 3x, 4x, 5x)
  gameSpeed: number;
  setGameSpeed(speed: number): void;

  /* setters */
  addEnemy(e: Enemy): void;
  removeEnemy(id: number, reward: number): void;
  addProjectile(p: Projectile): void;
  removeProjectile(id: number): void;
  nextWave(): void;
  applyRegen(): void;
  resetGame(): void;
  updateGameTime(): void;

  // Categorized upgrades
  upgradeAttack(stat: "damage" | "range" | "fireRate"): void;
  upgradeDefense(stat: "health" | "regen"): void;
  upgradeUtility(stat: "enemyReward" | "waveBonus"): void;
}

let enemyId = 0;
let gameId = 0; // Track unique game session
let gameInitialized = false; // Track if game has been initialized before
let isFirstGame = true; // Flag to track if this is the very first game

export const useGame = create<Store>((set, get) => ({
  enemies: [],
  projectiles: [],
  coins: 2500, // Starting coins (increased for testing)
  wave: 1,

  // Starting tower stats
  towerHp: 10,
  maxTowerHp: 10,
  hpRegen: 0,
  damage: 20,
  range: 3,
  fireRate: 1200,
  enemyRewardMult: 1.0,
  waveRewardMult: 1.0,

  // Track upgrade levels
  lastShot: 0,
  dmgLvl: 0,
  rngLvl: 0,
  frLvl: 0,
  hpLvl: 0,
  regenLvl: 0,
  enemyRewardLvl: 0,
  waveRewardLvl: 0,

  // Game timer
  gameTime: 0,

  // Game speed (default 1x)
  gameSpeed: 1,
  setGameSpeed: (speed) => set({ gameSpeed: speed }),

  addEnemy: (e) => set((s) => ({ enemies: [...s.enemies, e] })),

  removeEnemy: (id, reward) =>
    set((s) => ({
      enemies: s.enemies.filter((e) => e.id !== id),
      coins: s.coins + Math.round(reward * s.enemyRewardMult),
    })),

  addProjectile: (p) => set((s) => ({ projectiles: [...s.projectiles, p] })),

  removeProjectile: (id) =>
    set((s) => ({ projectiles: s.projectiles.filter((p) => p.id !== id) })),

  nextWave: () => {
    const currentWave = get().wave;
    console.log(
      `Advancing from Wave ${currentWave} to Wave ${currentWave + 1}`
    );

    set((s) => ({
      wave: s.wave + 1,
      coins: s.coins + Math.round(s.wave * 10 * s.waveRewardMult), // Wave completion bonus
    }));
  },

  applyRegen: () =>
    set((s) => ({
      towerHp: Math.min(s.maxTowerHp, s.towerHp + s.hpRegen),
    })),

  updateGameTime: () => set((state) => ({ gameTime: state.gameTime + 1 })),

  resetGame: () => {
    // Reset enemyId to 0 when game is reset
    enemyId = 0;
    gameId++; // Increment game ID to ensure complete reset
    gameInitialized = true;

    console.log(`Game reset - new gameId: ${gameId}`);
    isFirstGame = false; // After first reset, mark as not the first game

    return set({
      enemies: [],
      projectiles: [],
      coins: 2500, // Keep high starting coins for testing
      wave: 1,
      towerHp: 10,
      maxTowerHp: 10,
      hpRegen: 0,
      damage: 20,
      range: 3,
      fireRate: 1200,
      enemyRewardMult: 1.0,
      waveRewardMult: 1.0,
      lastShot: 0,
      dmgLvl: 0,
      rngLvl: 0,
      frLvl: 0,
      hpLvl: 0,
      regenLvl: 0,
      enemyRewardLvl: 0,
      waveRewardLvl: 0,
      gameTime: 0,
      gameSpeed: 1, // Reset game speed when restarting
    });
  },

  // Upgrade functions by category
  upgradeAttack: (stat) =>
    set((s) => {
      const lvl =
        stat === "damage" ? s.dmgLvl : stat === "range" ? s.rngLvl : s.frLvl;
      const cost = calcCost("attack", stat, lvl);

      if (s.coins < cost) return s;

      if (stat === "damage") {
        return {
          coins: s.coins - cost,
          damage: s.damage + ATTACK_INCREMENT.damage,
          dmgLvl: s.dmgLvl + 1,
        };
      } else if (stat === "range") {
        return {
          coins: s.coins - cost,
          range: s.range + ATTACK_INCREMENT.range,
          rngLvl: s.rngLvl + 1,
        };
      } else {
        // fireRate
        return {
          coins: s.coins - cost,
          fireRate: Math.max(100, s.fireRate - ATTACK_INCREMENT.fireRate),
          frLvl: s.frLvl + 1,
        };
      }
    }),

  upgradeDefense: (stat) =>
    set((s) => {
      const lvl = stat === "health" ? s.hpLvl : s.regenLvl;
      const cost = calcCost("defense", stat, lvl);

      if (s.coins < cost) return s;

      if (stat === "health") {
        return {
          coins: s.coins - cost,
          maxTowerHp: s.maxTowerHp + DEFENSE_INCREMENT.health,
          towerHp: s.towerHp + DEFENSE_INCREMENT.health, // Also heal when upgrading max HP
          hpLvl: s.hpLvl + 1,
        };
      } else {
        // regen
        return {
          coins: s.coins - cost,
          hpRegen: s.hpRegen + DEFENSE_INCREMENT.regen,
          regenLvl: s.regenLvl + 1,
        };
      }
    }),

  upgradeUtility: (stat) =>
    set((s) => {
      const lvl = stat === "enemyReward" ? s.enemyRewardLvl : s.waveRewardLvl;
      const cost = calcCost("utility", stat, lvl);

      if (s.coins < cost) return s;

      if (stat === "enemyReward") {
        return {
          coins: s.coins - cost,
          enemyRewardMult: s.enemyRewardMult + UTILITY_INCREMENT.enemyReward,
          enemyRewardLvl: s.enemyRewardLvl + 1,
        };
      } else {
        // waveBonus
        return {
          coins: s.coins - cost,
          waveRewardMult: s.waveRewardMult + UTILITY_INCREMENT.waveBonus,
          waveRewardLvl: s.waveRewardLvl + 1,
        };
      }
    }),
}));

/* ---------- Tower & Visuals ------------------------------------------------- */
function Tower() {
  const tex = useMemo(() => new TextureLoader().load("/Tralala.png"), []);
  return (
    <sprite scale={[1.2, 1.2, 1]}>
      <spriteMaterial map={tex} />
    </sprite>
  );
}

function RangeCircle() {
  const range = useGame((s) => s.range);
  const towerHp = useGame((s) => s.towerHp); // Get tower hp to hide circle on game over
  const { size, camera } = useThree();

  const zoom = (camera as THREE.OrthographicCamera).zoom;
  const diameterPx = range * 2 * zoom;

  // Don't show range circle when game is over
  if (towerHp <= 0) return null;

  return (
    <Html center>
      <div
        style={{
          width: diameterPx,
          height: diameterPx,
          border: "2px solid rgba(0, 255, 255, 0.5)",
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 5, // Lower z-index so it doesn't block overlays
        }}
      />
    </Html>
  );
}

function EnemySprite({ enemy }: { enemy: Enemy }) {
  const ref = useRef<THREE.Sprite>(null!);
  const removeEnemy = useGame((s) => s.removeEnemy);
  const gameSpeed = useGame((s) => s.gameSpeed);

  useFrame((_, dt) => {
    // Apply game speed to dt
    const scaledDt = dt * gameSpeed;

    enemy.pos.add(
      enemy.pos
        .clone()
        .multiplyScalar(-1)
        .normalize()
        .multiplyScalar(enemy.speed * scaledDt)
    );
    ref.current.position.copy(enemy.pos);

    if (enemy.pos.length() < 0.6) {
      // Tower collision - damage doesn't scale with game speed
      // so enemies deal damage at the same rate regardless of game speed
      useGame.setState((s) => ({ towerHp: s.towerHp - 1 }));
      removeEnemy(enemy.id, 0); // no reward on hit
    }
  });
  return (
    <sprite ref={ref} scale={[0.4, 0.4, 1]}>
      <spriteMaterial color={ENEMY_TYPES[enemy.kind].color} />
    </sprite>
  );
}

function ProjectileSprite({ proj }: { proj: Projectile }) {
  const ref = useRef<THREE.Sprite>(null!);
  const removeProjectile = useGame((s) => s.removeProjectile);
  const removeEnemy = useGame((s) => s.removeEnemy);
  const enemies = useGame((s) => s.enemies);
  const gameSpeed = useGame((s) => s.gameSpeed);

  useFrame((_, dt) => {
    // Apply game speed to dt
    const scaledDt = dt * gameSpeed;

    proj.pos.add(proj.dir.clone().multiplyScalar(proj.speed * scaledDt));
    ref.current.position.copy(proj.pos);

    for (const e of enemies) {
      if (proj.pos.distanceTo(e.pos) < 0.6) {
        e.hp -= proj.dmg;
        removeProjectile(proj.id);
        if (e.hp <= 0) removeEnemy(e.id, e.reward);
        return;
      }
    }
    if (proj.pos.length() > 14) removeProjectile(proj.id);
  });
  return (
    <sprite ref={ref} scale={[0.3, 0.3, 1]}>
      <spriteMaterial color="white" />
    </sprite>
  );
}

/* ---------- HP Regen Timer -------------------------------------------------- */
function RegenTimer() {
  const { hpRegen, applyRegen, gameSpeed } = useGame();

  useEffect(() => {
    if (hpRegen <= 0) return;

    // Scale regen timer with game speed
    const timer = setInterval(() => {
      applyRegen();
    }, 1000 / gameSpeed); // Apply regen based on game speed

    return () => clearInterval(timer);
  }, [hpRegen, applyRegen, gameSpeed]); // Add gameSpeed as dependency

  return null;
}

/* ---------- Auto‑fire ------------------------------------------------------- */
function AutoFire() {
  const { clock } = useThree();
  const enemies = useGame((s) => s.enemies);
  const addProjectile = useGame((s) => s.addProjectile);
  const { damage, range, fireRate, lastShot, towerHp, gameSpeed } = useGame();

  useFrame((_, dt) => {
    // Don't fire if tower is destroyed
    if (towerHp <= 0) return;

    // Apply game speed to firing rate for consistent gameplay at all speeds
    const now = clock.getElapsedTime() * 1_000;
    if (now - lastShot < fireRate / gameSpeed || !enemies.length) return;

    const closest = enemies
      .filter((e) => e.pos.length() <= range)
      .sort((a, b) => a.pos.length() - b.pos.length())[0];
    if (!closest) return;

    addProjectile({
      id: Math.random(),
      pos: new Vector3(0, 0, 0),
      dir: closest.pos.clone().normalize(),
      speed: 8 * gameSpeed, // Speed up projectiles with game speed
      dmg: damage,
    });
    useGame.setState({ lastShot: now });
  });
  return null;
}

/* ---------- Wave spawner ---------------------------------------------------- */
function Spawner() {
  const addEnemy = useGame((s) => s.addEnemy);
  const wave = useGame((s) => s.wave);
  const enemies = useGame((s) => s.enemies);
  const nextWave = useGame((s) => s.nextWave);
  const towerHp = useGame((s) => s.towerHp);
  const gameSpeed = useGame((s) => s.gameSpeed);

  // Track current game session to prevent stale updates
  const currentGameId = useRef(gameId);
  const waveRef = useRef(wave); // Track wave changes
  const toSpawnRef = useRef(0);
  const timeAccRef = useRef(0);
  const waveActiveRef = useRef(true);
  const waveCompletedRef = useRef(false); // Track if wave completion was handled

  // Reset when game ID changes (complete reset)
  useEffect(() => {
    currentGameId.current = gameId;
    console.log(`Spawner synced to gameId: ${gameId}, wave: ${wave}`);

    // Reset all refs when gameId changes
    toSpawnRef.current = 10 + (wave - 1) * 5;
    timeAccRef.current = 0;
    waveActiveRef.current = true;
    waveCompletedRef.current = false;
    waveRef.current = wave;
  }, [gameId, wave]);

  // Handle when wave changes
  useEffect(() => {
    if (waveRef.current !== wave) {
      console.log(`Wave changed from ${waveRef.current} to ${wave}`);
      waveRef.current = wave;

      // Reset spawning for new wave
      toSpawnRef.current = 10 + (wave - 1) * 5;
      timeAccRef.current = 0;
      waveActiveRef.current = true;
      waveCompletedRef.current = false;
    }
  }, [wave]);

  // Handle tower destruction
  useEffect(() => {
    if (towerHp <= 0) {
      waveActiveRef.current = false;
      console.log("Tower destroyed, stopping spawns");
    }
  }, [towerHp]);

  useFrame((_, dt) => {
    // Sync with current game session
    if (currentGameId.current !== gameId) {
      currentGameId.current = gameId;
      toSpawnRef.current = 10 + (wave - 1) * 5;
      timeAccRef.current = 0;
      waveActiveRef.current = true;
      waveCompletedRef.current = false;
      console.log(
        `Spawner detected game reset, syncing to gameId: ${gameId}, wave: ${wave}`
      );
      return;
    }

    // Don't spawn or update if tower is destroyed
    if (towerHp <= 0) return;

    // Don't process if wave isn't active
    if (!waveActiveRef.current) return;

    // Apply game speed to dt
    const scaledDt = dt * gameSpeed;

    // Spawn timer - faster spawns in later waves but consistent across game speeds
    const baseSpawnInterval = Math.max(1.5 - wave * 0.05, 0.5);
    timeAccRef.current += scaledDt;

    if (toSpawnRef.current > 0 && timeAccRef.current >= baseSpawnInterval) {
      timeAccRef.current -= baseSpawnInterval;
      toSpawnRef.current--;

      // Get number of enemies spawned in current wave
      const enemiesSpawned = 10 + (wave - 1) * 5 - toSpawnRef.current;
      const totalEnemies = 10 + (wave - 1) * 5;
      console.log(
        `Spawning enemy ${enemiesSpawned}/${totalEnemies} in wave ${wave}`
      );

      /* Choose enemy archetype based on wave progression from the wiki */
      let kind: EnemyKind = "normal";

      // Special enemies at the end of each wave with appropriate chances
      if (wave % 10 === 0 && toSpawnRef.current === 0) {
        // Boss every 10 waves at the end
        kind = "boss";
      } else if (wave >= 18 && Math.random() < 0.15) {
        // Protectors start appearing at wave 18
        kind = "protector";
      } else if (wave >= 12 && Math.random() < 0.2) {
        // Archers start appearing at wave 12
        kind = "archer";
      } else if (wave >= 5 && Math.random() < 0.25) {
        // Tanks start appearing at wave 5
        kind = "tank";
      } else if (wave >= 3 && Math.random() < 0.3) {
        // Fast enemies start appearing at wave 3
        kind = "fast";
      }

      const cfg = ENEMY_TYPES[kind];

      // Improved HP scaling for more gradual progression
      const baseHP = 15 + wave * 5;
      const baseSpeed = 0.5 + wave * 0.02; // Slower speed scaling

      // Early game enemies should be easier
      const hpMultiplier = wave <= 2 ? 0.5 : 1.0;

      // Spawn from a random angle
      const angle = Math.random() * Math.PI * 2;
      const radius = 10;

      // Create enemy with integer HP (Math.floor)
      const enemy = {
        id: enemyId++,
        pos: new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0),
        speed: baseSpeed * cfg.speedX,
        hp: Math.floor(baseHP * cfg.hpX * hpMultiplier),
        kind,
        reward: cfg.reward,
      };

      // Add enemy to game state
      addEnemy(enemy);
      console.log(
        `Added ${kind} enemy with HP ${enemy.hp}, speed ${enemy.speed}`
      );
    }

    // Wave done? Handle only once per wave
    if (
      toSpawnRef.current === 0 &&
      enemies.length === 0 &&
      waveActiveRef.current &&
      !waveCompletedRef.current
    ) {
      console.log(`Wave ${wave} complete, moving to next wave`);
      waveCompletedRef.current = true; // Mark as completed to prevent multiple calls
      nextWave();
    }
  });

  return null;
}

/* ---------- Game Timer ------------------------------------------------------- */
function GameTimer() {
  const gameTime = useGame((state) => state.gameTime);
  const updateGameTime = useGame((state) => state.updateGameTime);
  const towerHp = useGame((state) => state.towerHp); // Get tower HP to check game state
  const gameSpeed = useGame((state) => state.gameSpeed); // Get game speed

  useEffect(() => {
    // Only create timer if tower is alive
    if (towerHp <= 0) return;

    const timer = setInterval(() => {
      updateGameTime();
    }, 1000 / gameSpeed); // Apply game speed to timer

    return () => clearInterval(timer);
  }, [updateGameTime, towerHp, gameSpeed]); // Add gameSpeed to dependencies

  // Format time as MM:SS
  const minutes = Math.floor(gameTime / 60);
  const seconds = gameTime % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.7)",
        padding: "8px 15px",
        borderRadius: "8px",
        color: "#ffcc00",
        fontFamily: "monospace",
        fontSize: "16px",
        fontWeight: "bold",
      }}
    >
      TIME: {formattedTime}
    </div>
  );
}

/* ---------- Game Speed Control ----------------------------------------------- */
function GameSpeedControl() {
  const gameSpeed = useGame((state) => state.gameSpeed);
  const setGameSpeed = useGame((state) => state.setGameSpeed);

  const speedOptions = [1, 2, 3, 4, 5];

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.7)",
        padding: "8px 15px",
        borderRadius: "8px",
        color: "white",
        fontFamily: "monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        zIndex: 10,
      }}
    >
      <div style={{ fontSize: "14px", marginBottom: "5px" }}>
        Game Speed: {gameSpeed}x
      </div>
      <div style={{ display: "flex", gap: "5px" }}>
        {speedOptions.map((speed) => (
          <button
            key={speed}
            onClick={() => setGameSpeed(speed)}
            style={{
              width: "30px",
              height: "30px",
              background: gameSpeed === speed ? "#ffcc00" : "#555",
              color: gameSpeed === speed ? "#333" : "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- HUD & Shop ------------------------------------------------------ */
function HUD() {
  const {
    coins,
    wave,
    enemies,
    towerHp,
    maxTowerHp,
    damage,
    range,
    fireRate,
    hpRegen,
    enemyRewardMult,
    waveRewardMult,
  } = useGame();

  // Format fire rate as shots per second
  const shotsPerSecond = (1000 / fireRate).toFixed(1);

  // Get enemy HP values for display
  const enemyHPDisplay =
    enemies.length > 0
      ? enemies.map((e) => Math.floor(e.hp)).join(", ")
      : "None";

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        maxWidth: "250px",
      }}
    >
      {/* Wave counter - more prominent */}
      <div
        style={{
          background: "rgba(0,0,0,0.8)",
          padding: "10px 15px",
          borderRadius: "8px",
          border: "2px solid #ffcc00",
          color: "white",
          fontFamily: "monospace",
          fontSize: "22px",
          textAlign: "center",
          fontWeight: "bold",
          boxShadow: "0 0 15px rgba(255, 204, 0, 0.5)",
        }}
      >
        WAVE {wave}
      </div>

      {/* HP Bar - more prominent */}
      <div
        style={{
          background: "rgba(0,0,0,0.8)",
          padding: "12px 15px",
          borderRadius: "8px",
          border:
            towerHp < maxTowerHp * 0.3
              ? "2px solid #ff3333"
              : "2px solid #33cc33",
          color: "white",
          fontFamily: "monospace",
          boxShadow:
            towerHp < maxTowerHp * 0.3
              ? "0 0 15px rgba(255, 51, 51, 0.5)"
              : "0 0 15px rgba(51, 204, 51, 0.3)",
        }}
      >
        <div
          style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "8px" }}
        >
          TOWER HP
        </div>
        <div
          style={{
            position: "relative",
            height: "24px",
            background: "#333",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${(towerHp / maxTowerHp) * 100}%`,
              background: towerHp < maxTowerHp * 0.3 ? "#ff3333" : "#33cc33",
              transition: "width 0.3s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          />
          <div
            style={{
              position: "relative",
              textAlign: "center",
              color: "white",
              textShadow: "0 0 3px black, 0 0 3px black, 0 0 3px black",
              fontSize: "16px",
              fontWeight: "bold",
              lineHeight: "24px",
            }}
          >
            {Math.floor(towerHp)}/{Math.floor(maxTowerHp)}
          </div>
        </div>
      </div>

      {/* Other game stats */}
      <div
        style={{
          background: "rgba(0,0,0,0.7)",
          padding: "10px 15px",
          borderRadius: "8px",
          color: "white",
          fontFamily: "monospace",
          fontSize: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div>
          Coins:{" "}
          <span style={{ color: "#ffcc00", fontWeight: "bold" }}>{coins}</span>
        </div>
        <div>Enemies: {enemies.length}</div>
        <div style={{ marginTop: "5px", fontSize: "12px", color: "#aaa" }}>
          Stats:
        </div>
        <div>• Damage: {Math.floor(damage)}</div>
        <div>• Range: {Math.floor(range)}</div>
        <div>• Fire Rate: {shotsPerSecond}/s</div>
        <div>• HP Regen: {Math.floor(hpRegen)}/s</div>
        <div>• Enemy Bonus: {Math.floor(enemyRewardMult * 100)}%</div>
        <div>• Wave Bonus: {Math.floor(waveRewardMult * 100)}%</div>
      </div>
    </div>
  );
}

function UpgradePanel() {
  const {
    coins,
    damage,
    range,
    fireRate,
    maxTowerHp,
    hpRegen,
    enemyRewardMult,
    waveRewardMult,
    dmgLvl,
    rngLvl,
    frLvl,
    hpLvl,
    regenLvl,
    enemyRewardLvl,
    waveRewardLvl,
    upgradeAttack,
    upgradeDefense,
    upgradeUtility,
  } = useGame();

  const makeButton = (
    category: "attack" | "defense" | "utility",
    stat: string,
    label: string,
    level: number,
    value: number | string,
    upgradeFunc: any
  ) => {
    const cost = calcCost(category, stat, level);
    const afford = coins >= cost;

    // Calculate the next value after upgrade
    let nextValue;
    if (category === "attack") {
      if (stat === "damage") {
        nextValue = damage + ATTACK_INCREMENT.damage;
      } else if (stat === "range") {
        nextValue = (range + ATTACK_INCREMENT.range).toFixed(1);
      } else {
        // fireRate
        nextValue =
          (1000 / Math.max(100, fireRate - ATTACK_INCREMENT.fireRate)).toFixed(
            1
          ) + "/s";
      }
    } else if (category === "defense") {
      if (stat === "health") {
        nextValue = maxTowerHp + DEFENSE_INCREMENT.health;
      } else {
        // regen
        nextValue = (hpRegen + DEFENSE_INCREMENT.regen).toFixed(1) + "/s";
      }
    } else {
      // utility
      if (stat === "enemyReward") {
        nextValue =
          ((enemyRewardMult + UTILITY_INCREMENT.enemyReward) * 100).toFixed(0) +
          "%";
      } else {
        // waveBonus
        nextValue =
          ((waveRewardMult + UTILITY_INCREMENT.waveBonus) * 100).toFixed(0) +
          "%";
      }
    }

    return (
      <button
        onClick={() => upgradeFunc(stat)}
        disabled={!afford}
        style={{
          margin: 4,
          padding: "8px 10px",
          width: "100%",
          background: afford ? "rgba(0,100,0,0.7)" : "rgba(50,50,50,0.7)",
          color: "white",
          border: "none",
          borderRadius: "4px",
          font: "14px monospace",
          cursor: afford ? "pointer" : "not-allowed",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          transition: "all 0.2s",
          textAlign: "left",
        }}
        title={`Upgrade ${label}`}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span>{label}</span>
          <span style={{ fontSize: "12px", color: "#aaa" }}>
            {value} → {nextValue}
          </span>
        </div>
        <div
          style={{
            background: afford ? "#ffcc00" : "#555",
            color: afford ? "#333" : "#aaa",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "bold",
          }}
        >
          {cost} ⟡
        </div>
      </button>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        bottom: 20,
        width: "280px",
        background: "rgba(0,0,0,0.7)",
        borderRadius: "8px",
        color: "white",
        padding: "15px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div
        style={{
          fontSize: "18px",
          textAlign: "center",
          fontWeight: "bold",
          marginBottom: "5px",
          color: "#ffcc00",
          background: "rgba(0,0,0,0.5)",
          padding: "8px",
          borderRadius: "4px",
          boxShadow: "0 0 8px rgba(255, 204, 0, 0.3)",
        }}
      >
        UPGRADES
      </div>

      {/* Attack Section */}
      <div>
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(200,50,50,0.3)",
            borderRadius: "4px",
            marginBottom: "8px",
            fontWeight: "bold",
          }}
        >
          ATTACK
        </div>
        {makeButton(
          "attack",
          "damage",
          "Attack Damage",
          dmgLvl,
          damage,
          upgradeAttack
        )}
        {makeButton(
          "attack",
          "fireRate",
          "Attack Speed",
          frLvl,
          (1000 / fireRate).toFixed(1) + "/s",
          upgradeAttack
        )}
        {makeButton(
          "attack",
          "range",
          "Attack Range",
          rngLvl,
          range.toFixed(1),
          upgradeAttack
        )}
      </div>

      {/* Defense Section */}
      <div>
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(50,200,50,0.3)",
            borderRadius: "4px",
            marginBottom: "8px",
            fontWeight: "bold",
          }}
        >
          DEFENSE
        </div>
        {makeButton(
          "defense",
          "health",
          "Max Health",
          hpLvl,
          maxTowerHp,
          upgradeDefense
        )}
        {makeButton(
          "defense",
          "regen",
          "Health Regen",
          regenLvl,
          hpRegen.toFixed(1) + "/s",
          upgradeDefense
        )}
      </div>

      {/* Utility Section */}
      <div>
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(50,50,200,0.3)",
            borderRadius: "4px",
            marginBottom: "8px",
            fontWeight: "bold",
          }}
        >
          UTILITY
        </div>
        {makeButton(
          "utility",
          "enemyReward",
          "Enemy Rewards",
          enemyRewardLvl,
          (enemyRewardMult * 100).toFixed(0) + "%",
          upgradeUtility
        )}
        {makeButton(
          "utility",
          "waveBonus",
          "Wave Bonus",
          waveRewardLvl,
          (waveRewardMult * 100).toFixed(0) + "%",
          upgradeUtility
        )}
      </div>
    </div>
  );
}

/* ---------- Game Over ------------------------------------------------------- */
function GameOver() {
  const { resetGame, wave, gameTime } = useGame();

  // Format time as MM:SS
  const minutes = Math.floor(gameTime / 60);
  const seconds = gameTime % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  // Handle Play Again button click
  const handlePlayAgain = () => {
    console.log("Play Again clicked, fully resetting game state");
    // Force a complete reset of game state
    setTimeout(() => {
      resetGame();
    }, 50); // Small delay to ensure clean reset
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 48,
        color: "red",
        background: "rgba(0,0,0,.9)",
        zIndex: 1000, // Much higher z-index to ensure it's above everything
        backdropFilter: "blur(5px)",
      }}
    >
      <div
        style={{
          color: "#ff3333",
          fontSize: "56px",
          fontWeight: "bold",
          textShadow: "0 0 20px rgba(255, 51, 51, 0.8)",
          marginBottom: "10px",
        }}
      >
        GAME OVER
      </div>

      <div
        style={{
          fontSize: "22px",
          color: "#ccc",
          margin: "10px 0 20px 0",
        }}
      >
        Your tower was destroyed!
      </div>

      <div
        style={{
          background: "rgba(50,50,50,0.7)",
          padding: "15px 25px",
          borderRadius: "8px",
          marginBottom: "25px",
          display: "flex",
          gap: "30px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontSize: "18px",
            color: "#ffcc00",
          }}
        >
          <div style={{ color: "#aaa", fontSize: "14px", marginBottom: "5px" }}>
            WAVE
          </div>
          {wave}
        </div>
        <div
          style={{
            textAlign: "center",
            fontSize: "18px",
            color: "#ffcc00",
          }}
        >
          <div style={{ color: "#aaa", fontSize: "14px", marginBottom: "5px" }}>
            TIME
          </div>
          {formattedTime}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "1.5rem",
          marginTop: "10px",
        }}
      >
        <button
          style={{
            border: "none",
            borderRadius: "12px",
            padding: "12px 30px",
            color: "white",
            background: "#cc0000",
            fontSize: "18px",
            cursor: "pointer",
            fontWeight: "bold",
            boxShadow: "0 0 15px rgba(204, 0, 0, 0.5)",
            transition: "all 0.2s",
          }}
          onClick={handlePlayAgain}
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Play Again
        </button>
        <button
          style={{
            border: "none",
            borderRadius: "12px",
            padding: "12px 30px",
            color: "white",
            background: "#555",
            fontSize: "18px",
            cursor: "pointer",
            fontWeight: "bold",
            transition: "all 0.2s",
          }}
          id="exitButton"
          onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
          onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

/* ---------- Exit Button ----------------------------------------------------- */
function ExitButton({ onExit }: { onExit: () => void }) {
  return (
    <button
      onClick={onExit}
      style={{
        position: "absolute",
        top: 20,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "8px 16px",
        background: "rgba(80,80,80,0.8)",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "14px",
        fontFamily: "monospace",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span style={{ fontSize: "18px" }}>⬅</span> Back to Home
    </button>
  );
}

/* ---------- Game root ------------------------------------------------------- */
interface GameProps {
  onExit: () => void;
}

export default function Game({ onExit }: GameProps) {
  const { towerHp, resetGame } = useGame();

  // Reset game state when mounting the component
  useEffect(() => {
    console.log("Game component mounted, resetting game state");

    // Force a full reset of the game state
    setTimeout(() => {
      resetGame();
    }, 100); // Small delay helps stabilize initialization

    return () => {
      // This component is about to unmount
      console.log("Game component unmounting");
    };
  }, [resetGame]);

  // Set up event listeners after component mount
  useEffect(() => {
    const exitButton = document.getElementById("exitButton");
    if (exitButton) {
      exitButton.addEventListener("click", onExit);
    }

    return () => {
      if (exitButton) {
        exitButton.removeEventListener("click", onExit);
      }
    };
  }, [towerHp, onExit]); // Re-run when towerHp changes (GameOver screen appears)

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Canvas orthographic camera={{ zoom: 50, position: [0, 0, 10] }}>
        <Suspense fallback={null}>
          <Tower />
          <RangeCircle />
          <Spawner
            key={`spawner-${gameId}-${towerHp > 0 ? "active" : "inactive"}`}
          />
          <AutoFire />
          <RegenTimer />
          {useGame.getState().enemies.map((e) => (
            <EnemySprite key={e.id} enemy={e} />
          ))}
          {useGame.getState().projectiles.map((p) => (
            <ProjectileSprite key={p.id} proj={p} />
          ))}
        </Suspense>
      </Canvas>

      <HUD />
      <GameTimer />
      <GameSpeedControl />
      <UpgradePanel />
      <ExitButton onExit={onExit} />
      {towerHp <= 0 && <GameOver />}
    </div>
  );
}
