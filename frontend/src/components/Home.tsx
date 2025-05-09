import React from "react";
import TowerDefenseGame from "./Game";

interface HomeProps {
  onDisconnect: () => void;
}

const Home = ({ onDisconnect }: HomeProps) => {
  return (
    <div className="h-screen flex flex-col">
      <header className="bg-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold font-['Press_Start_2P']">
          Solitary Meme TD
        </h1>
        <button
          onClick={onDisconnect}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
          style={{
            border: "2px solid #000",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "0.75rem",
          }}
        >
          Disconnect
        </button>
      </header>

      <main className="flex-grow">
        <TowerDefenseGame />
      </main>
    </div>
  );
};

export default Home;
