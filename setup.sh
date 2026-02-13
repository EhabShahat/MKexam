#!/bin/bash

# Advanced Exam Application - Setup Script
# This script helps you set up the application for the first time

set -e

echo "🚀 Advanced Exam Application Setup"
echo "=================================="
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js 20 or higher is required"
    echo "   Current version: $(node -v)"
    echo "   Please upgrade Node.js and try again"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found"
    echo "   Please create .env.local with your Supabase credentials"
    exit 1
fi

echo "✅ Environment file found"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo ""
echo "✅ Dependencies installed successfully"
echo ""

# Check if database setup is needed
echo "📊 Database Setup"
echo "================="
echo ""
echo "To set up your database, you need to:"
echo "1. Go to your Supabase project dashboard"
echo "2. Navigate to SQL Editor"
echo "3. Run the following SQL files in order:"
echo "   - db/schema.sql"
echo "   - db/security.sql"
echo "   - db/rpc_functions.sql"
echo "   - db/indexes.sql"
echo "   - db/app_settings.sql"
echo "   - db/storage_setup.sql"
echo ""
echo "Or use the npm scripts:"
echo "   npm run setup:database"
echo "   npm run setup:storage"
echo ""

# Create admin user instructions
echo "👤 Admin User Setup"
echo "==================="
echo ""
echo "After database setup, create an admin user:"
echo "   npm run create:admin"
echo ""

# Final instructions
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "To start the development server:"
echo "   npm run dev"
echo ""
echo "The application will be available at:"
echo "   http://localhost:3000"
echo ""
echo "📚 Important Notes:"
echo "   - Make sure to update JWT_SECRET in .env.local"
echo "   - Configure your Supabase project settings"
echo "   - Review the README.md for detailed documentation"
echo ""
