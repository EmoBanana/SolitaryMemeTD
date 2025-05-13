@echo off
REM This script runs Anchor commands through WSL
REM Usage: anchor-wsl.bat [command] [args...]

REM Navigate to the current directory in WSL
set CURRENT_DIR=%CD%
set WSL_DIR=%CURRENT_DIR:\=/%
set WSL_DIR=%WSL_DIR::=%
set WSL_PATH=/mnt/%WSL_DIR%

REM Run the command through WSL
echo Running 'anchor %*' in WSL...
wsl bash -c "cd %WSL_PATH% && anchor %*" 