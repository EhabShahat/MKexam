# 🥚 Easter Egg Admin Panel

## Secret Feature: Blocked Entries Management

This is a hidden admin feature accessible at `/eg` that allows super admins to block exam attempts by student name, IP address, or mobile number.

### 🔐 Access

1. Navigate to `/eg` in your browser
2. Enter the password: `easteregg2024` or `admin123`
3. Access the secret admin panel

### 🚫 Features

- **Block by Student Name**: Prevent specific students from taking exams
- **Block by IP Address**: Block entire IP addresses or ranges
- **Block by Mobile Number**: Block students by their registered mobile numbers
- **Reason Tracking**: Add optional reasons for blocking
- **Audit Trail**: All blocks/unblocks are logged in the audit system
- **Real-time Blocking**: Blocks take effect immediately

### 🛠️ Setup

1. Run the setup script in your Supabase SQL editor:
   ```sql
   -- Copy and paste the contents of scripts/setup-easter-egg.sql
   ```

2. The feature is now ready to use!

### 🎯 How It Works

When a student tries to access an exam:
1. The system checks if their name, IP, or mobile number is in the blocked list
2. If blocked, they receive an "Access Denied" message
3. The block reason is shown to the user (if provided)
4. The attempt is logged in the audit system

**Note**: Mobile number blocking only works when students use access codes (since mobile numbers are stored in the student database).

### 🔒 Security

- Only authenticated admins can access the API endpoints
- All actions are logged in the audit trail
- Password protection on the frontend (basic layer)
- Row Level Security (RLS) enabled on the database table

### 🎨 UI Features

- Beautiful gradient background with glassmorphism design
- Easter egg themed icons and messaging
- Responsive design for mobile and desktop
- Real-time updates when adding/removing blocks
- Loading states and error handling

### 🤫 Keep It Secret!

This is an easter egg feature - it's not meant to be discovered by regular users. Only share the `/eg` URL and password with trusted super admins.

### 📝 Example Use Cases

- Block test accounts during production
- Temporarily restrict access for specific users
- Block suspicious IP addresses
- Prevent cheating attempts from known sources
- Emergency access control during exam issues

### 🔧 Customization

You can customize the password by editing the `handleAuth` function in `/src/app/eg/page.tsx`:

```typescript
if (password === "your-custom-password") {
  setAuthenticated(true);
}
```

### 🎉 Fun Facts

- The page uses a 🥚 emoji theme throughout
- Glassmorphism design with backdrop blur effects
- Gradient backgrounds for that premium feel
- Hidden hints in the password prompt
- Easter egg themed messaging and copy

Enjoy your secret admin powers! 🚀