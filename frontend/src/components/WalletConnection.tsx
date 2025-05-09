import { useState } from "react";

interface WalletConnectionProps {
  onConnect: () => void;
  onCancel: () => void;
}

const WalletConnection = ({ onConnect, onCancel }: WalletConnectionProps) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    setIsConnecting(true);

    setTimeout(() => {
      setIsConnecting(false);
      onConnect();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Connect Your Wallet
        </h2>

        <div className="space-y-4">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full p-4 flex items-center justify-between bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <span className="flex items-center">Phantom</span>
            {isConnecting && (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            )}
          </button>

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full p-4 flex items-center justify-between bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <span className="flex items-center">Solflare</span>
            {isConnecting && (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            )}
          </button>
        </div>

        <div className="mt-6 flex justify-center">
          <button onClick={onCancel} className="text-gray-400 hover:text-white">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalletConnection;
