#!/bin/bash

echo "🚀 Starting Business Chat App Server..."
echo "📡 Server will be accessible globally via port forwarding"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Start the server
echo "🌐 Starting server on port 3000..."
echo "📱 Local access: http://localhost:3000"
echo "🌍 For global access, use port forwarding tools like:"
echo "   • ngrok: ngrok http 3000"
echo "   • localtunnel: npx localtunnel --port 3000"
echo "   • Router port forwarding: Forward port 3000 to your local IP"
echo ""
echo "⚙️  Make sure to add your public URL to Supabase Auth settings!"
echo ""

node server.js