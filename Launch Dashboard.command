#!/bin/bash
# ───────────────────────────────────────────────────────────────
# Gateway Management Dashboard — double-click launcher (macOS)
# Double-click this file in Finder to start the dashboard.
# It installs dependencies the first time, then opens your browser.
# Leave the Terminal window open while presenting; close it to stop.
# ───────────────────────────────────────────────────────────────

cd "$(dirname "$0")" || exit 1

clear
echo "============================================================"
echo "  Gateway Management — Portfolio Dashboard"
echo "============================================================"
echo

# Check for Node.js
if ! command -v npm >/dev/null 2>&1; then
  echo "⚠  Node.js is not installed."
  echo "   Download it from https://nodejs.org (LTS version),"
  echo "   install it, then double-click this file again."
  echo
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

# Install dependencies on first run
if [ ! -d "node_modules" ]; then
  echo "First-time setup — installing dependencies (one or two minutes)…"
  npm install || { echo "Install failed."; read -n 1 -s -r -p "Press any key to close..."; exit 1; }
  echo
fi

echo "Starting the dashboard…"
echo "Your browser will open at  http://localhost:3000"
echo
echo "➡  To STOP the dashboard: close this Terminal window"
echo "   (or press Control-C here)."
echo "============================================================"
echo

# react-scripts opens the browser automatically
BROWSER=open npm start
