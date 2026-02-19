
@echo off
cd /d "%~dp0"
ECHO Launching Windows Terminal with a VERTICAL split...

:: Use "split-pane -V" for a vertical (side-by-side) split.
wt.exe cmd /k "ngrok http 3000"; split-pane -V cmd /k "cd /d \"%~dp0\ " && npm run dev" 