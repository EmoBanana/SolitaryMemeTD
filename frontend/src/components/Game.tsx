import React, { Suspense, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { TextureLoader, Vector3 } from "three";
import * as THREE from "three";
import { create } from "zustand";

/* ──────────────────────────────────────────────────────────────────────────────
   ↑↑  CUSTOMISE SHOP PRICES HERE  ↑↑
   Each upgrade cost = BASE × (SCALING^current level).
   Feel free to tweak the numbers below to fit your game‑economy.             */
const COST_BASE = { damage: 15, range: 20, fireRate: 25 };
const COST_SCALING = { damage: 1.3, range: 1.35, fireRate: 1.4 };
/* ──────────────────────────────────────────────────────────────────────────── */

const calcCost = (stat: keyof typeof COST_BASE, level: number) =>
  Math.round(COST_BASE[stat] * Math.pow(COST_SCALING[stat], level));

/* ---------- Enemy archetypes ------------------------------------------------ */
const ENEMY_TYPES = {
  normal: { color: "red", hpX: 1, speedX: 1, reward: 1 },
  fast: { color: "yellow", hpX: 0.6, speedX: 2, reward: 2 },
  tank: { color: "purple", hpX: 3, speedX: 0.5, reward: 3 },
  boss: { color: "black", hpX: 10, speedX: 0.4, reward: 10 },
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
  towerHp: number;
  damage: number;
  range: number;
  fireRate: number;
  lastShot: number;
  dmgLvl: number;
  rngLvl: number;
  frLvl: number;
  /* setters */
  addEnemy(e: Enemy): void;
  removeEnemy(id: number, reward: number): void;
  addProjectile(p: Projectile): void;
  removeProjectile(id: number): void;
  nextWave(): void;
  upgrade(stat: "damage" | "range" | "fireRate"): void;
}
export const useGame = create<Store>((set, get) => ({
  enemies: [],
  projectiles: [],
  coins: 100,
  wave: 1,
  towerHp: 10,
  damage: 25,
  range: 4,
  fireRate: 1_000,
  lastShot: 0,
  dmgLvl: 0,
  rngLvl: 0,
  frLvl: 0,
  addEnemy: (e) => set((s) => ({ enemies: [...s.enemies, e] })),
  removeEnemy: (id, reward) =>
    set((s) => ({
      enemies: s.enemies.filter((e) => e.id !== id),
      coins: s.coins + reward,
    })),
  addProjectile: (p) => set((s) => ({ projectiles: [...s.projectiles, p] })),
  removeProjectile: (id) =>
    set((s) => ({ projectiles: s.projectiles.filter((p) => p.id !== id) })),
  nextWave: () => set((s) => ({ wave: s.wave + 1 })),
  upgrade: (stat) =>
    set((s) => {
      const lvl =
        stat === "damage" ? s.dmgLvl : stat === "range" ? s.rngLvl : s.frLvl;
      const cost = calcCost(stat, lvl);
      if (s.coins < cost) return s;

      /* apply effect & bump level */
      if (stat === "damage")
        return {
          ...s,
          coins: s.coins - cost,
          damage: s.damage + 5,
          dmgLvl: s.dmgLvl + 1,
        };
      if (stat === "range")
        return {
          ...s,
          coins: s.coins - cost,
          range: s.range + 1,
          rngLvl: s.rngLvl + 1,
        };
      return {
        ...s,
        coins: s.coins - cost,
        fireRate: Math.max(100, s.fireRate - 100),
        frLvl: s.frLvl + 1,
      };
    }),
}));

/* ---------- Visuals --------------------------------------------------------- */
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
  const { size, camera } = useThree(); // r3f hook

  /* pixels‑per‑world‑unit in an orthographic cam = camera.zoom */
  const zoom = (camera as THREE.OrthographicCamera).zoom;
  const diameterPx = range * 2 * zoom; // world → px

  return (
    <Html center /* anchors to world [0,0,0] but in DOM */>
      <div
        style={{
          width: diameterPx,
          height: diameterPx,
          border: "2px solid cyan",
          borderRadius: "50%",
          pointerEvents: "none", // clicks pass through
        }}
      />
    </Html>
  );
}

function EnemySprite({ enemy }: { enemy: Enemy }) {
  const ref = useRef<THREE.Sprite>(null!);
  const removeEnemy = useGame((s) => s.removeEnemy);
  useFrame((_, dt) => {
    enemy.pos.add(
      enemy.pos
        .clone()
        .multiplyScalar(-1)
        .normalize()
        .multiplyScalar(enemy.speed * dt)
    );
    ref.current.position.copy(enemy.pos);

    if (enemy.pos.length() < 0.6) {
      // tower collision
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

  useFrame((_, dt) => {
    proj.pos.add(proj.dir.clone().multiplyScalar(proj.speed * dt));
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

/* ---------- Auto‑fire ------------------------------------------------------- */
function AutoFire() {
  const { clock } = useThree();
  const enemies = useGame((s) => s.enemies);
  const addProjectile = useGame((s) => s.addProjectile);
  const { damage, range, fireRate, lastShot } = useGame();

  useFrame(() => {
    const now = clock.getElapsedTime() * 1_000;
    if (now - lastShot < fireRate || !enemies.length) return;
    const closest = enemies
      .filter((e) => e.pos.length() <= range)
      .sort((a, b) => a.pos.length() - b.pos.length())[0];
    if (!closest) return;

    addProjectile({
      id: Math.random(),
      pos: new Vector3(0, 0, 0),
      dir: closest.pos.clone().normalize(),
      speed: 8,
      dmg: damage,
    });
    useGame.setState({ lastShot: now });
  });
  return null;
}

/* ---------- Wave spawner ---------------------------------------------------- */
let enemyId = 0;
function Spawner() {
  const addEnemy = useGame((s) => s.addEnemy);
  const wave = useGame((s) => s.wave);
  const enemies = useGame((s) => s.enemies);
  const nextWave = useGame((s) => s.nextWave);

  //   how many left to spawn this wave?
  const toSpawnRef = useRef(0);
  const timeAccRef = useRef(0);

  /* reset counters whenever a new wave starts */
  useEffect(() => {
    toSpawnRef.current = 10 + (wave - 1) * 5; // 10 → +5 each wave
    timeAccRef.current = 0;
  }, [wave]);

  useFrame((_, dt) => {
    // ---------------------------------------------------------------- spawn timer
    const spawnInterval = Math.max(1.5 - wave * 0.05, 0.6); // never < 0.6 s
    timeAccRef.current += dt;

    if (toSpawnRef.current > 0 && timeAccRef.current >= spawnInterval) {
      timeAccRef.current -= spawnInterval; // keep surplus time
      toSpawnRef.current--;

      /* ---------- choose enemy archetype ----------------------------------- */
      const kind: EnemyKind =
        wave % 10 === 0 && toSpawnRef.current === 10 + (wave - 1) * 5
          ? "boss"
          : wave >= 7 && Math.random() < 0.2
          ? "tank"
          : wave >= 4 && Math.random() < 0.35
          ? "fast"
          : "normal";

      const cfg = ENEMY_TYPES[kind];
      const baseHP = 20 + wave * 5;
      const baseSpeed = 0.5 + wave * 0.05;

      // spawn 12 units away on a random angle
      const angle = Math.random() * Math.PI * 2;
      const radius = 10;
      addEnemy({
        id: enemyId++,
        pos: new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0),
        speed: baseSpeed * cfg.speedX,
        hp: baseHP * cfg.hpX,
        kind,
        reward: cfg.reward,
      });
    }

    // ------------------------------------------------------------ wave done?
    if (toSpawnRef.current === 0 && enemies.length === 0) nextWave();
  });

  return null;
}

/* ---------- HUD & Shop ------------------------------------------------------ */
function HUD() {
  const { coins, wave, enemies, towerHp } = useGame();
  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 10,
        color: "white",
        fontFamily: "monospace",
      }}
    >
      <div>HP {towerHp}</div>
      <div>Wave {wave}</div>
      <div>Enemies {enemies.length}</div>
      <div>Coins {coins}</div>
    </div>
  );
}

function Shop() {
  const { coins, damage, range, fireRate, upgrade, dmgLvl, rngLvl, frLvl } =
    useGame();
  const makeBtn = (
    stat: "damage" | "range" | "fireRate",
    label: string,
    value: number
  ) => {
    const level =
      stat === "damage" ? dmgLvl : stat === "range" ? rngLvl : frLvl;
    const cost = calcCost(stat, level);
    const afford = coins >= cost;
    return (
      <button
        key={stat}
        onClick={() => upgrade(stat)}
        disabled={!afford}
        style={{
          margin: 4,
          padding: "6px 10px",
          background: afford ? "#1a1" : "#611",
          color: "white",
          border: "none",
          font: "14px monospace",
          cursor: afford ? "pointer" : "not-allowed",
        }}
        title={`Cost: ${cost} coins`}
      >
        {label}:{" "}
        {stat === "fireRate" ? (1000 / value).toFixed(1) + "/s" : value} (⟡ 
        {cost})
      </button>
    );
  };
  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      {makeBtn("damage", "Damage", damage)}
      {makeBtn("range", "Range", range)}
      {makeBtn("fireRate", "Fire Rate", fireRate)}
    </div>
  );
}

/* ---------- Game root ------------------------------------------------------- */
export default function Game() {
  const enemies = useGame((s) => s.enemies);
  const projectiles = useGame((s) => s.projectiles);
  const towerHp = useGame((s) => s.towerHp);

  return (
    <>
      <Canvas orthographic camera={{ zoom: 50, position: [0, 0, 10] }}>
        <Suspense fallback={null}>
          <Tower />
          <RangeCircle />
          <Spawner />
          <AutoFire />
          {enemies.map((e) => (
            <EnemySprite key={e.id} enemy={e} />
          ))}
          {projectiles.map((p) => (
            <ProjectileSprite key={p.id} proj={p} />
          ))}
        </Suspense>
      </Canvas>

      <HUD />
      <Shop />
      {towerHp <= 0 && <GameOver />}
    </>
  );
}

function GameOver() {
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
        background: "rgba(0,0,0,.8)",
      }}
    >
      GAME OVER
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "1rem",
        }}
      >
        <button
          style={{
            border: "4px solid white",
            borderRadius: "12px",
            padding: "0.5rem",
            color: "black",
            background: "white",
          }}
          onClick={() => window.location.reload()}
        >
          Play Again
        </button>
        <button
          style={{
            border: "4px solid white",
            borderRadius: "12px",
            padding: "0.5rem",
            color: "black",
            background: "white",
          }}
        >
          Home
        </button>
      </div>
    </div>
  );
}
