@echo off
echo Creating NFTs using spl-token command...

REM Create the first NFT - Tralala
echo Creating Tralala NFT...
spl-token create-token --decimals 0
echo Please copy the token address and use it in your Solana program

REM Create the second NFT - Bombardino
echo Creating Bombardino NFT...
spl-token create-token --decimals 0
echo Please copy the token address and use it in your Solana program

REM Create the third NFT - TungSahur
echo Creating TungSahur NFT...
spl-token create-token --decimals 0
echo Please copy the token address and use it in your Solana program

echo All NFTs created!
echo Remember to use these token addresses in your Solana program.
pause 