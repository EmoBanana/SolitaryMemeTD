import React from "react";
import UpgradeCard, { UpgradeSection } from "./UpgradeCard";

// Add JSX namespace declaration to fix linter errors
declare namespace JSX {
  interface IntrinsicElements {
    div: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLDivElement>,
      HTMLDivElement
    >;
    style: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLStyleElement>,
      HTMLStyleElement
    >;
  }
}

const UpgradeCardExample: React.FC = () => {
  // Sample data for demo purposes
  const attackCards = [
    {
      label: "Attack Damage",
      currentValue: 20,
      nextValue: 24,
      cost: 20,
      description:
        "Increase tower damage against enemies. More damage means faster kills.",
    },
    {
      label: "Attack Speed",
      currentValue: "0.8/s",
      nextValue: "1.0/s",
      cost: 30,
      description:
        "Fire projectiles more frequently. Faster attacks mean more DPS.",
    },
    {
      label: "Attack Range",
      currentValue: "3.0",
      nextValue: "3.2",
      cost: 25,
      description:
        "Extend your tower's attack reach to hit enemies from farther away.",
    },
    {
      label: "Splash Damage",
      currentValue: "None",
      nextValue: "Small",
      cost: 50,
      description: "Attack multiple enemies at once with area damage.",
    },
  ];

  const defenseCards = [
    {
      label: "Max Health",
      currentValue: 10,
      nextValue: 11,
      cost: 30,
      description:
        "Increase your tower's maximum health to withstand more damage.",
    },
    {
      label: "Health Regen",
      currentValue: "0.0/s",
      nextValue: "0.1/s",
      cost: 50,
      description: "Regenerate health over time to stay in the fight longer.",
    },
    {
      label: "Armor",
      currentValue: "0%",
      nextValue: "5%",
      cost: 40,
      description: "Reduce incoming damage from all sources.",
    },
    {
      label: "Shield",
      currentValue: "0",
      nextValue: "5",
      cost: 45,
      description: "Add a protective shield that absorbs damage before health.",
    },
  ];

  const utilityCards = [
    {
      label: "Enemy Rewards",
      currentValue: "100%",
      nextValue: "105%",
      cost: 40,
      description: "Earn more rewards when defeating enemies.",
    },
    {
      label: "Wave Bonus",
      currentValue: "100%",
      nextValue: "110%",
      cost: 60,
      description: "Increase the bonus shards earned at the end of each wave.",
    },
    {
      label: "Critical Hit",
      currentValue: "0%",
      nextValue: "5%",
      cost: 55,
      description: "Chance to deal double damage with attacks.",
    },
    {
      label: "Loot Chance",
      currentValue: "1%",
      nextValue: "2%",
      cost: 70,
      description: "Higher chance to find rare items after defeating enemies.",
    },
  ];

  return (
    <div
      style={{
        width: "100%",
        background: "rgba(10,10,30,0.8)",
        borderRadius: "10px",
        color: "white",
        padding: "15px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        border: "1px solid rgba(100,100,255,0.1)",
        boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
        maxWidth: "800px",
        maxHeight: "80vh",
        overflowY: "auto",
        overflowX: "hidden",
        scrollbarWidth: "thin",
        scrollbarColor: "#555 #222",
      }}
    >
      {/* Custom scrollbar styling */}
      <style>
        {`
          /* Webkit browsers like Chrome/Safari */
          div::-webkit-scrollbar {
            width: 8px;
          }
          
          div::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.2);
            border-radius: 4px;
          }
          
          div::-webkit-scrollbar-thumb {
            background: rgba(255,204,0,0.4);
            border-radius: 4px;
          }
          
          div::-webkit-scrollbar-thumb:hover {
            background: rgba(255,204,0,0.6);
          }
        `}
      </style>

      {/* Attack Section */}
      <UpgradeSection title="ATTACK" category="attack">
        {attackCards.map((card, index) => (
          <UpgradeCard
            key={index}
            label={card.label}
            currentValue={card.currentValue}
            nextValue={card.nextValue}
            cost={card.cost}
            category="attack"
            affordable={index < 3} // Example: most are affordable
            description={card.description}
          />
        ))}
      </UpgradeSection>

      {/* Defense Section */}
      <UpgradeSection title="DEFENSE" category="defense">
        {defenseCards.map((card, index) => (
          <UpgradeCard
            key={index}
            label={card.label}
            currentValue={card.currentValue}
            nextValue={card.nextValue}
            cost={card.cost}
            category="defense"
            affordable={index < 3}
            description={card.description}
          />
        ))}
      </UpgradeSection>

      {/* Utility Section */}
      <UpgradeSection title="UTILITY" category="utility">
        {utilityCards.map((card, index) => (
          <UpgradeCard
            key={index}
            label={card.label}
            currentValue={card.currentValue}
            nextValue={card.nextValue}
            cost={card.cost}
            category="utility"
            affordable={index < 2} // Example: only first two affordable
            description={card.description}
          />
        ))}
      </UpgradeSection>
    </div>
  );
};

export default UpgradeCardExample;
