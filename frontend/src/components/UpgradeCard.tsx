import React from "react";

// Add JSX namespace declaration to fix linter errors
declare namespace JSX {
  interface IntrinsicElements {
    div: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLDivElement>,
      HTMLDivElement
    >;
    span: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLSpanElement>,
      HTMLSpanElement
    >;
    img: React.DetailedHTMLProps<
      React.ImgHTMLAttributes<HTMLImageElement>,
      HTMLImageElement
    >;
  }
}

type UpgradeCardProps = {
  label: string;
  currentValue: string | number;
  nextValue: string | number;
  cost: number;
  category?: "attack" | "defense" | "utility";
  affordable?: boolean;
  description?: string;
};

const UpgradeCard: React.FC<UpgradeCardProps> = ({
  label,
  currentValue,
  nextValue,
  cost,
  category = "attack",
  affordable = true,
  description = "",
}) => {
  // Determine background color based on category
  const getCategoryColor = () => {
    switch (category) {
      case "attack":
        return "rgba(200,50,50,0.3)";
      case "defense":
        return "rgba(50,200,50,0.3)";
      case "utility":
        return "rgba(50,50,200,0.3)";
      default:
        return "rgba(200,50,50,0.3)";
    }
  };

  const getCategoryBorderColor = () => {
    switch (category) {
      case "attack":
        return "rgba(200,50,50,0.8)";
      case "defense":
        return "rgba(50,200,50,0.8)";
      case "utility":
        return "rgba(50,50,200,0.8)";
      default:
        return "rgba(200,50,50,0.8)";
    }
  };

  return (
    <div
      style={{
        margin: 8,
        padding: "15px",
        width: "100%",
        background: "rgba(30, 30, 60, 0.8)",
        color: "white",
        border: `2px solid ${getCategoryBorderColor()}`,
        borderRadius: "8px",
        font: "14px monospace",
        cursor: affordable ? "pointer" : "not-allowed",
        transition: "all 0.2s",
        textAlign: "left",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
        opacity: affordable ? 1 : 0.7,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        height: "100%",
      }}
    >
      <div
        style={{
          padding: "6px 10px",
          background: getCategoryColor(),
          borderRadius: "4px",
          fontWeight: "bold",
          fontSize: "16px",
          marginBottom: "5px",
        }}
      >
        {label}
      </div>

      {description && (
        <div
          style={{
            fontSize: "12px",
            color: "#aaa",
            marginBottom: "5px",
            lineHeight: "1.3",
          }}
        >
          {description}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "auto",
        }}
      >
        <div>
          <div style={{ fontSize: "14px", color: "#aaa" }}>
            <span style={{ color: "#fff" }}>{currentValue}</span> →{" "}
            <span style={{ color: "#ffcc00", fontWeight: "bold" }}>
              {nextValue}
            </span>
          </div>
        </div>
        <div
          style={{
            background: affordable ? "rgba(255, 204, 0, 0.2)" : "#333",
            color: affordable ? "#ffcc00" : "#666",
            padding: "6px 10px",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>{cost}</span>
          <img
            src="/Shards.png"
            alt="Shards"
            style={{ width: "18px", height: "18px" }}
          />
        </div>
      </div>
    </div>
  );
};

// Upgrade section component that groups cards
export const UpgradeSection: React.FC<{
  title: string;
  category: "attack" | "defense" | "utility";
  children: React.ReactNode;
}> = ({ title, category, children }) => {
  const getCategoryColor = () => {
    switch (category) {
      case "attack":
        return "rgba(200,50,50,0.5)";
      case "defense":
        return "rgba(50,200,50,0.5)";
      case "utility":
        return "rgba(50,50,200,0.5)";
      default:
        return "rgba(200,50,50,0.5)";
    }
  };

  return (
    <div style={{ marginBottom: "20px" }}>
      <div
        style={{
          padding: "12px 15px",
          background: getCategoryColor(),
          borderRadius: "8px 8px 0 0",
          fontWeight: "bold",
          fontSize: "18px",
          textAlign: "center",
          textTransform: "uppercase",
          letterSpacing: "1px",
          color: "white",
          textShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: "10px",
          padding: "15px",
          background: "rgba(0,0,0,0.3)",
          borderRadius: "0 0 8px 8px",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default UpgradeCard;
