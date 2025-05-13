@echo off
echo Starting Multiplayer Test Environment...

echo Installing backend dependencies...
cd frontend/backend
call npm install
cd ../..

echo Installing frontend dependencies...
cd frontend
call npm install socket.io-client
cd ..

echo Starting servers...
echo.
echo Backend: http://localhost:3001
echo Frontend: Check the output for the URL (typically http://localhost:5173)
echo.
echo Open multiple browser windows/tabs to test with different wallets
echo.

start cmd /k "cd frontend/backend && npm start"
start cmd /k "cd frontend && npm run dev"

echo.
echo Press any key to exit this window (servers will continue running)...
pause > nul 