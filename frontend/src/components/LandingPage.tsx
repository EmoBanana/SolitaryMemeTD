import React from "react";

interface LandingPageProps {
  onPlayClick: () => void;
}

const LandingPage = ({ onPlayClick }: LandingPageProps) => {
  const [isPlayHovering, setIsPlayHovering] = React.useState(false);
  const [isTrailerHovering, setIsTrailerHovering] = React.useState(false);

  const handleWatchTrailer = () => {
    window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "_blank");
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Background gradient overlay */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(130deg, #1e1b4b 0%, #4338ca 50%, #312e81 100%)",
          opacity: 0.9,
        }}
      />

      {/* Magical particle effects */}
      <div
        className="absolute inset-0 z-10 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(#a5b4fc 1px, transparent 1px), radial-gradient(#818cf8 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          backgroundPosition: "0 0, 20px 20px",
        }}
      />

      {/* Main character image - rotated to face top left */}
      <img
        src="/Tralala.png"
        alt="Game Character"
        className="absolute z-20 h-[120vh] object-contain transform -rotate-[-20deg]"
        style={{
          right: "-20%",
          bottom: "-40%",
          filter: "drop-shadow(0 0 20px rgba(93, 93, 255, 0.4))",
        }}
      />

      {/* Projectile animation - coming from character toward top left */}
      <div
        className="absolute z-30"
        style={{
          top: "40%",
          right: "42%",
          animation: "moveTopLeft 3s infinite",
        }}
      >
        <img
          src="/blue_projectile.png"
          alt="Magic Projectile"
          className="w-54 h-54 object-contain transform -rotate-[-23deg]"
          style={{
            filter: "drop-shadow(0 0 15px rgba(59, 130, 246, 0.8))",
          }}
        />
      </div>

      {/* Navigation bar */}
      <header className="relative z-40 pt-6 px-8 flex justify-between items-center">
        <div className="flex items-center">
          <h2
            className="text-2xl font-bold text-white"
            style={{ fontFamily: "'Jersey20', sans-serif" }}
          >
            SMTD
          </h2>
        </div>

        <nav className="flex space-x-8">
          <a
            href="#"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Game Info
          </a>
          <a
            href="#"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Token
          </a>
          <a
            href="#"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Lore
          </a>
          <a
            href="#"
            className="text-gray-300 hover:text-white transition-colors"
          >
            About
          </a>
        </nav>

        <div className="flex space-x-4">
          <button className="px-4 py-2 bg-yellow-500 text-indigo-900 font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
            Buy Shards
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-30 flex flex-col justify-center h-[80vh] pl-24 mt-26 max-w-3xl">
        <div className="flex flex-col">
          <h1
            className="text-[14rem] font-bold text-white leading-none whitespace-nowrap"
            style={{
              textShadow: "0 0 30px rgba(93, 93, 255, 0.4)",
              fontFamily: "'Pixellari', sans-serif",
              letterSpacing: "-0.01em",
              lineHeight: "8rem",
            }}
          >
            <span
              style={{
                background: "linear-gradient(90deg, #9945ff, #14f195)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                display: "inline",
              }}
            >
              Sol
            </span>
            itary
          </h1>
          <h2
            className="text-[12rem] font-bold text-white-300 mb-6 leading-none whitespace-nowrap"
            style={{
              textShadow: "0 0 30px rgba(93, 93, 255, 0.4)",
              fontFamily: "'Jersey20', sans-serif",
              transform: "translateX(8px)",
              letterSpacing: "-0.01em",
            }}
          >
            Meme TD
          </h2>
        </div>

        <p
          className="text-5xl mb-16 text-gray-200 max-w-lg font-bold"
          style={{
            fontFamily: "'Pixellari', sans-serif",
            letterSpacing: "0.05em",
          }}
        >
          HODL The Horde
        </p>

        <div className="flex gap-4 mt-[-1rem]">
          <button
            onClick={onPlayClick}
            onMouseEnter={() => setIsPlayHovering(true)}
            onMouseLeave={() => setIsPlayHovering(false)}
            className={`px-23 py-4 rounded-lg transition-all duration-300 text-2xl ${
              isPlayHovering
                ? "bg-white text-indigo-900 scale-105 shadow-lg"
                : "bg-white/90 text-indigo-900"
            }`}
            style={{
              fontWeight: "bold",
              fontFamily: "'Pixellari', sans-serif",
            }}
          >
            Play now
          </button>

          <button
            onClick={handleWatchTrailer}
            onMouseEnter={() => setIsTrailerHovering(true)}
            onMouseLeave={() => setIsTrailerHovering(false)}
            className={`px-23 py-4 rounded-lg transition-all duration-300 text-2xl ${
              isTrailerHovering
                ? "border-2 border-white text-white scale-105"
                : "border-2 border-white/70 text-white/90"
            }`}
            style={{
              fontWeight: "bold",
              fontFamily: "'Pixellari', sans-serif",
            }}
          >
            Watch trailer
          </button>
        </div>

        {/* Social media links */}
        <div className="flex items-center gap-6 mt-16">
          <span className="text-gray-400 text-sm">Join us on:</span>
          <div className="flex gap-8">
            <a
              href="#"
              className="h-6 w-6 opacity-70 hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="white"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="#"
              className="h-6 w-6 opacity-70 hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="white"
              >
                <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.02-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .02.01.04.03.05 1.8 1.32 3.53 2.12 5.24 2.65.03.01.06 0 .07-.02.4-.55.76-1.13 1.07-1.74.02-.04 0-.08-.04-.09-.57-.22-1.11-.48-1.64-.78-.04-.02-.04-.08-.01-.11.11-.08.22-.17.33-.25.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.03.04.09-.01.11-.52.31-1.07.56-1.64.78-.04.01-.05.06-.04.09.32.61.68 1.19 1.07 1.74.03.02.06.03.09.02 1.72-.53 3.45-1.33 5.25-2.65.02-.01.03-.03.03-.05.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" />
              </svg>
            </a>
            <a
              href="#"
              className="h-6 w-6 opacity-70 hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="white"
              >
                <path d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-8.054-2.685z" />
              </svg>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
