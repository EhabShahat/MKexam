# 🚀 Startup Guide - Advanced Exam Application

## ✅ Setup Complete!

Your Advanced Exam Application is now configured with:
- ✅ Node.js 20.20.0 (via nvm)
- ✅ npm 10.8.2
- ✅ All dependencies installed (870 packages)
- ✅ Environment variables configured

## 🎯 Quick Start

### Option 1: Using the helper script (Recommended)
```bash
./dev.sh
```

### Option 2: Manual start
```bash
# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node.js 20
nvm use

# Start development server
npm run dev
```

### Option 3: Add to your shell profile (Permanent solution)
Add these lines to your `~/.bashrc` or `~/.zshrc`:

```bash
# Load nvm automatically
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Auto-use Node.js version from .nvmrc
autoload -U add-zsh-hook
load-nvmrc() {
  local node_version="$(nvm version)"
  local nvmrc_path="$(nvm_find_nvmrc)"

  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version=$(nvm version "$(cat "${nvmrc_path}")")

    if [ "$nvmrc_node_version" = "N/A" ]; then
      nvm install
    elif [ "$nvmrc_node_version" != "$node_version" ]; then
      nvm use
    fi
  elif [ "$node_version" != "$(nvm version default)" ]; then
    echo "Reverting to nvm default version"
    nvm use default
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
```

Then reload your shell:
```bash
source ~/.bashrc  # or source ~/.zshrc
```

## 🔧 Next Steps

### 1. Configure JWT Secret
Update the `JWT_SECRET` in `.env.local` with your actual Supabase JWT secret:

1. Go to your Supabase Dashboard
2. Navigate to: Settings > API
3. Copy the "JWT Secret"
4. Update `.env.local`:
   ```
   JWT_SECRET=your-actual-jwt-secret-from-supabase
   ```

### 2. Set Up Database
Run the database setup scripts in your Supabase SQL Editor:

```bash
# Option 1: Use npm scripts (if available)
npm run setup:database
npm run setup:storage

# Option 2: Manual setup via Supabase Dashboard
# Go to SQL Editor and run these files in order:
# 1. db/schema.sql
# 2. db/security.sql
# 3. db/rpc_functions.sql
# 4. db/indexes.sql
# 5. db/app_settings.sql
# 6. db/storage_setup.sql
```

### 3. Create Admin User
After database setup, create your first admin user:

```bash
npm run create:admin
```

## 📱 Application URLs

Once running, access the application at:

- **Home Page**: http://localhost:3000
- **Admin Login**: http://localhost:3000/admin/login
- **Admin Dashboard**: http://localhost:3000/admin

## 🛠️ Available Commands

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
npm run type-check       # TypeScript type checking

# Database Setup
npm run setup:database   # Initialize database schema
npm run setup:storage    # Setup Supabase storage buckets
npm run create:admin     # Create admin user

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
```

## 🔍 Troubleshooting

### Issue: "Node.js version not found"
**Solution**: Make sure nvm is loaded before running commands:
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use
```

### Issue: "Cannot find module" errors
**Solution**: Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Issue: Database connection errors
**Solution**: Verify your Supabase credentials in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

### Issue: Port 3000 already in use
**Solution**: Either kill the process using port 3000 or use a different port:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

## 📚 Documentation

- **[README.md](README.md)** - Project overview and features
- **[API_CHANGES_DOCUMENTATION.md](API_CHANGES_DOCUMENTATION.md)** - API reference
- **[ENHANCED_DEVICE_TRACKING.md](ENHANCED_DEVICE_TRACKING.md)** - Device tracking docs
- **[SCORE_CALCULATION_ARCHITECTURE.md](SCORE_CALCULATION_ARCHITECTURE.md)** - Score system

## 🎨 Key Features

### For Students
- Multi-language support (Arabic/English)
- Auto-save functionality
- Real-time timer
- Responsive design
- Accessibility features

### For Administrators
- Complete exam management
- Student registry
- Results analytics
- Live monitoring
- Audit logging
- WhatsApp integration

## 🔒 Security Notes

- Never commit `.env.local` to version control
- Keep your JWT_SECRET secure
- Use strong passwords for admin accounts
- Enable IP restrictions for sensitive exams
- Review audit logs regularly

## 💡 Tips

1. **Use the helper scripts**: `./dev.sh` makes starting the app easier
2. **Check the logs**: Development server shows helpful error messages
3. **Use TypeScript**: The app is fully typed for better development experience
4. **Test thoroughly**: Run tests before deploying changes
5. **Read the docs**: Comprehensive documentation is available

## 🆘 Need Help?

1. Check the troubleshooting section above
2. Review the comprehensive documentation
3. Check the test suite for expected behavior
4. Consult the API documentation
5. Contact the development team

---

**Happy Coding! 🎉**
