# 🚀 Quick Start - Global Chat App

## 1. Start Server
```bash
npm start
# or
./start.sh
```

## 2. Enable Global Access
```bash
# Install ngrok
npm install -g ngrok

# In new terminal
ngrok http 3000
```

## 3. Configure Supabase
1. Copy ngrok URL (e.g., `https://abc123.ngrok.io`)
2. Go to Supabase Dashboard > Authentication > Settings
3. Set **Site URL** to your ngrok URL
4. Add same URL to **Additional Redirect URLs**

## 4. Share with Users
- Share your ngrok URL globally
- Users can create accounts and chat instantly
- Use @username to search and mention users

## ✅ Features
- Global user registration
- Real-time chat with @username search
- Posts, stories, and music integration
- Mobile-friendly interface

## 🌍 Access
- **Local**: http://localhost:3000
- **Global**: Your ngrok URL
- **Mobile**: Same URL works on phones

That's it! Your chat app is now globally accessible! 🎉