import React from "react";
import { useAppKitAccount, useDisconnect } from "@reown/appkit/react";
import { Connection, PublicKey } from "@solana/web3.js";
import { useNavigate } from "react-router-dom";

interface HomeProps {
  onDisconnect: () => void;
}

const SMTD_TOKEN_SYMBOL = "SMTD";
const SMTD_MINT = "B3G9uhi7euWErYvwfTye2MpDJytkYX6mAgUhErHbnSoT";

// Update RPC endpoints with Helius as primary
const RPC_ENDPOINTS = [
  "https://devnet.helius-rpc.com/?api-key=bb60d3b9-ed20-448d-a3fe-96b8f541b19b", // Helius devnet provided by user
  "https://api.devnet.solana.com", // Fallback to regular devnet
];

const Home = ({ onDisconnect }: HomeProps) => {
  // Wallet info
  const { address } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();

  // Initialize balance to 0
  const [balance, setBalance] = React.useState<string>("0");
  const [isLoadingBalance, setIsLoadingBalance] =
    React.useState<boolean>(false);

  // Fetch SMTD token balance with better error handling
  React.useEffect(() => {
    const fetchBalance = async () => {
      if (!address) {
        setBalance("0");
        return;
      }

      setIsLoadingBalance(true);

      // Try each RPC endpoint
      for (const endpoint of RPC_ENDPOINTS) {
        try {
          const connection = new Connection(endpoint);
          const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(address),
            { mint: new PublicKey(SMTD_MINT) }
          );

          // If token account is found, update balance
          if (tokenAccounts.value.length > 0) {
            const amount =
              tokenAccounts.value[0]?.account.data.parsed.info.tokenAmount;
            if (amount && amount.amount) {
              setBalance(
                (
                  Number(amount.amount) / Math.pow(10, amount.decimals || 9)
                ).toLocaleString()
              );
              setIsLoadingBalance(false);
              return; // Exit if successful
            }
          }

          // No token account found, set balance to 0
          setBalance("0");
          setIsLoadingBalance(false);
          return;
        } catch (e) {
          console.log(`Error fetching balance from ${endpoint}:`, e);
          // Continue to next endpoint on failure
        }
      }

      // If all endpoints fail, set balance to 0
      setBalance("0");
      setIsLoadingBalance(false);
    };

    fetchBalance();
  }, [address]);

  // Handle disconnect
  const handleDisconnect = async () => {
    await disconnect();
    onDisconnect();
  };

  // Handle Summon button
  const handleSummon = () => {
    navigate("/game");
  };

  // Handle Multiplayer button
  const handleMultiplayer = () => {
    navigate("/multiplayer");
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center flex flex-col"
      style={{
        backgroundImage: 'url("/Background.png")',
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-10 py-6 bg-black/60">
        {/* Left: Title */}
        <div
          className="text-3xl font-bold text-white"
          style={{ fontFamily: "'Jersey20', sans-serif" }}
        >
          SMTD
        </div>
        {/* Center: Nav */}
        <nav className="flex gap-10 text-xl font-bold text-white">
          <a href="#" className="hover:text-yellow-300 transition">
            Towers
          </a>
          <a href="#" className="hover:text-yellow-300 transition">
            Upgrades
          </a>
          <a href="#" className="hover:text-yellow-300 transition">
            Shop
          </a>
        </nav>
        {/* Right: Token balance & wallet */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <div className="bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold shadow flex items-center">
              {isLoadingBalance ? (
                <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : null}
              {balance} {SMTD_TOKEN_SYMBOL}
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="bg-white/20 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-mono font-bold transition"
            title="Click to disconnect"
          >
            {address
              ? `${address.slice(0, 4)}...${address.slice(-4)}`
              : "Connect Wallet"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-col items-center justify-center flex-grow">
        <h2
          className="text-5xl md:text-6xl font-bold text-white drop-shadow-lg mb-10 text-center"
          style={{ fontFamily: "'Pixellari', sans-serif" }}
        >
          One Meme, Countless Enemies.
        </h2>
        <div className="flex flex-col sm:flex-row gap-6">
          <button
            onClick={handleSummon}
            className="px-10 py-5 bg-yellow-400 hover:bg-yellow-300 text-black text-3xl font-bold rounded-xl shadow-lg transition-all"
            style={{ fontFamily: "'Pixellari', sans-serif" }}
          >
            Summon Your Tower
          </button>
          <button
            onClick={handleMultiplayer}
            className="px-10 py-5 bg-purple-600 hover:bg-purple-500 text-white text-3xl font-bold rounded-xl shadow-lg transition-all"
            style={{ fontFamily: "'Pixellari', sans-serif" }}
          >
            Multiplayer Mode
          </button>
        </div>
        <div className="mt-4 text-sm text-gray-300 bg-black/50 p-2 rounded">
          Multiplayer: Create or join a room with a 6-digit code. Challenge
          others and stake SOL to win!
        </div>
      </main>
    </div>
  );
};

export default Home;
