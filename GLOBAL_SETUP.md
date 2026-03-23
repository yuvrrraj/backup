# Global Access Setup Guide

## 🌍 Running the Chat App Globally

This guide will help you set up the Business Chat App for global access so users worldwide can create accounts and chat with each other.

## Prerequisites

- Node.js installed on your system
- Supabase account and project (already configured)
- Internet connection
- Port forwarding capability

## Quick Start

### 1. Start the Server
```bash
# Option 1: Use the startup script
./start.sh

# Option 2: Direct command
npm start

# Option 3: Manual start
node server.js
```

### 2. Enable Global Access

Choose one of these methods:

#### Method A: Using ngrok (Recommended)
```bash
# Install ngrok globally
npm install -g ngrok

# In a new terminal, expose port 3000
ngrok http 3000
```
Copy the https URL (e.g., `https://abc123.ngrok.io`)

#### Method B: Using localtunnel
```bash
# Expose port 3000
npx localtunnel --port 3000
```

#### Method C: Router Port Forwarding
1. Access your router admin panel
2. Forward external port 3000 to your local IP:3000
3. Use your public IP address

### 3. Configure Supabase for Global Access

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication > Settings**
4. In **Site URL**, add your global URL:
   - For ngrok: `https://abc123.ngrok.io`
   - For localtunnel: `https://your-subdomain.loca.lt`
   - For port forwarding: `http://your-public-ip:3000`

5. In **Additional Redirect URLs**, add the same URL

## 🎯 How Users Can Access

### For Users Worldwide:
1. Share your global URL (from ngrok/localtunnel/port forwarding)
2. Users visit the URL in their browser
3. Users can create accounts with username/email
4. Users can search and chat with each other using @username

### Example URLs:
- `https://abc123.ngrok.io` (ngrok)
- `https://myapp.loca.lt` (localtunnel)
- `http://203.0.113.1:3000` (port forwarding)

## 🔧 Features Available Globally

✅ **User Registration**: Anyone can create an account
✅ **Username Search**: Find users with @username
✅ **Real-time Chat**: Instant messaging between users
✅ **Posts & Stories**: Share content with music
✅ **Follow System**: Follow/unfollow other users
✅ **Profile Management**: Customize profiles

## 🛡️ Security Notes

- Supabase handles authentication and data security
- All data is stored securely in your Supabase database
- RLS (Row Level Security) policies protect user data
- HTTPS recommended for production (use ngrok https)

## 📱 Mobile Access

Users can access the app on mobile devices by:
1. Opening the global URL in mobile browser
2. Adding to home screen for app-like experience
3. All features work on mobile browsers

## 🔄 Keeping It Running

### For Development:
- Use ngrok for temporary testing
- Restart ngrok if URL changes

### For Production:
- Use a VPS/cloud server
- Set up proper domain name
- Use PM2 for process management:
```bash
npm install -g pm2
pm2 start server.js --name "chat-app"
pm2 startup
pm2 save
```

## 🐛 Troubleshooting

### Common Issues:

1. **"Site URL not allowed"**
   - Add your URL to Supabase Auth settings

2. **Users can't register**
   - Check Supabase email settings
   - Verify Site URL configuration

3. **Chat not working**
   - Ensure real-time subscriptions are enabled in Supabase
   - Check browser console for errors

4. **Port 3000 already in use**
   ```bash
   # Use different port
   PORT=3001 node server.js
   ```

## 📞 Support

If users encounter issues:
1. Check browser console for errors
2. Verify internet connection
3. Try refreshing the page
4. Clear browser cache if needed

## 🎉 Success!

Once set up, users worldwide can:
- Visit your global URL
- Create accounts instantly
- Search for other users with @username
- Start chatting immediately
- Share posts and stories
- Build their social network

Your Business Chat App is now globally accessible! 🌍