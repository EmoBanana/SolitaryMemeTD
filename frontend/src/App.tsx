import React, { useState, useEffect } from "react";
import "./index.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import LandingPage from "./components/LandingPage";
import Home from "./components/Home";
import Game from "./components/Game";
import MultiplayerLobby from "./components/MultiplayerLobby";
import MultiplayerGame from "./components/MultiplayerGame";
import { createAppKit, useAppKitAccount } from "@reown/appkit/react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";
import { solana, solanaTestnet, solanaDevnet } from "@reown/appkit/networks";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

// Handle Web3Modal API timeouts - add timeout wrapper to fetch API
if (window.fetch && !window.fetchWrapped) {
  window.fetchWrapped = true; // Mark as wrapped to avoid double-wrapping
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    // Only add timeout for Web3Modal requests
    if (typeof input === "string" && input.includes("web3modal.org")) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const newInit = init
        ? { ...init, signal: controller.signal }
        : { signal: controller.signal };

      return originalFetch
        .call(this, input, newInit)
        .catch((err) => {
          if (err.name === "AbortError") {
            console.warn("Web3Modal API request timed out:", input);
            // Return an empty JSON response instead of failing
            return new Response(JSON.stringify({}), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          throw err;
        })
        .finally(() => clearTimeout(timeoutId));
    }

    return originalFetch.apply(this, arguments);
  };
}

// 0. Set up Solana Adapter
const solanaWeb3JsAdapter = new SolanaAdapter({
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
});

// 1. Get projectId from https://cloud.reown.com
const projectId = "d0a6bc64ba1ad976bea8200020e44ec1";

// 2. Create a metadata object
const metadata = {
  name: "SMTD",
  description: "Solitary Meme Tower Defense",
  url: "https://smtd.app", // Should match your domain
  icons: ["https://assets.reown.com/reown-profile-pic.png"],
};

// 3. Create modal
try {
  createAppKit({
    adapters: [solanaWeb3JsAdapter],
    networks: [solana, solanaTestnet, solanaDevnet],
    metadata: metadata,
    projectId,
    features: {
      analytics: false, // Disable analytics to avoid timeouts
    },
  });
  console.log("AppKit initialized successfully");
} catch (error) {
  console.error("Failed to initialize AppKit:", error);
}

// TypeScript JSX configuration
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elementName: string]: any;
    }
  }
  interface Window {
    fetchWrapped?: boolean;
  }
}

// Protected route component to handle auth redirect
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isConnected } = useAppKitAccount();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!isConnected) {
      navigate("/");
    }
  }, [isConnected, navigate]);

  if (!isConnected) {
    return null; // Or a loading spinner
  }

  return <>{children}</>;
};

// Landing page with navigation
const LandingPageWithNav = () => {
  const navigate = useNavigate();

  const handleWalletConnect = () => {
    navigate("/home");
  };

  return <LandingPage onWalletConnect={handleWalletConnect} />;
};

// Home page with navigation
const HomeWithNav = () => {
  const navigate = useNavigate();

  const handleDisconnect = () => {
    navigate("/");
  };

  return <Home onDisconnect={handleDisconnect} />;
};

// Game page with navigation
const GameWithNav = () => {
  const navigate = useNavigate();

  // Navigate back to home when game is exited
  const handleGameExit = () => {
    navigate("/home");
  };

  return <Game onExit={handleGameExit} />;
};

// Multiplayer lobby with navigation
const MultiplayerLobbyWithNav = () => {
  const navigate = useNavigate();

  const handleBackToHome = () => {
    navigate("/home");
  };

  return <MultiplayerLobby onBack={handleBackToHome} />;
};

// Multiplayer game with navigation
const MultiplayerGameWithNav = () => {
  const navigate = useNavigate();

  const handleExitToLobby = () => {
    navigate("/multiplayer");
  };

  return <MultiplayerGame onExit={handleExitToLobby} />;
};

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-indigo-900 text-white">
        <Routes>
          <Route path="/" element={<LandingPageWithNav />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <HomeWithNav />
              </ProtectedRoute>
            }
          />
          <Route
            path="/game"
            element={
              <ProtectedRoute>
                <GameWithNav />
              </ProtectedRoute>
            }
          />
          <Route
            path="/multiplayer"
            element={
              <ProtectedRoute>
                <MultiplayerLobbyWithNav />
              </ProtectedRoute>
            }
          />
          <Route
            path="/multiplayer-game/:roomId"
            element={
              <ProtectedRoute>
                <MultiplayerGameWithNav />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
