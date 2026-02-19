#!/bin/bash

# Load nvm and start development server
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use the correct Node.js version
nvm use

# Start the development server
npm run dev
