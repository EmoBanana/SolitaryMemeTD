import React from "react";
import "./index.css";
import LandingPage from "./components/LandingPage";
import WalletConnection from "./components/WalletConnection";
import Home from "./components/Home";

// TypeScript JSX configuration
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      [elementName: string]: any;
    }
  }
}

function App() {
  const [gameState, setGameState] = React.useState<
    "landing" | "connecting" | "playing"
  >("landing");
  const [walletConnected, setWalletConnected] = React.useState(false);

  const handlePlayClick = () => {
    setGameState("connecting");
  };

  const handleWalletConnect = () => {
    setWalletConnected(true);
    setGameState("playing");
  };

  const handleWalletCancel = () => {
    setGameState("landing");
  };

  const handleDisconnect = () => {
    setWalletConnected(false);
    setGameState("landing");
  };

  return (
    <div className="min-h-screen bg-indigo-900 text-white">
      {gameState === "landing" && <LandingPage onPlayClick={handlePlayClick} />}

      {gameState === "connecting" && (
        <WalletConnection
          onConnect={handleWalletConnect}
          onCancel={handleWalletCancel}
        />
      )}

      {gameState === "playing" && <Home onDisconnect={handleDisconnect} />}
    </div>
  );
}

export default App;
