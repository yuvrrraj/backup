# Music Integration Guide

This guide explains how to integrate real music APIs into your Instagram-like app.

## Current Implementation

The app currently includes:
- Music input fields for posts and stories
- Database columns for storing music metadata (`music_name`, `music_artist`, `music_url`)
- UI display of selected music in posts
- Placeholder functions for API integration

## Spotify Web API Integration

### 1. Setup Spotify Developer Account
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Get your Client ID and Client Secret

### 2. Get Access Token
```javascript
async function getSpotifyToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
    },
    body: 'grant_type=client_credentials'
  });
  const data = await response.json();
  return data.access_token;
}
```

### 3. Search Music
```javascript
async function searchSpotifyMusic(query, token) {
  const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  return data.tracks.items.map(track => ({
    name: track.name,
    artist: track.artists[0].name,
    preview_url: track.preview_url,
    external_url: track.external_urls.spotify
  }));
}
```

## Apple Music API Integration

### 1. Setup Apple Developer Account
1. Get Apple Music API key from Apple Developer Portal
2. Generate JWT token for authentication

### 2. Search Implementation
```javascript
async function searchAppleMusic(query, token) {
  const response = await fetch(`https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(query)}&types=songs&limit=10`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await response.json();
  return data.results.songs.data.map(song => ({
    name: song.attributes.name,
    artist: song.attributes.artistName,
    preview_url: song.attributes.previews?.[0]?.url,
    external_url: song.attributes.url
  }));
}
```

## YouTube Music API Integration

### 1. Setup Google Cloud Project
1. Enable YouTube Data API v3
2. Get API key

### 2. Search Implementation
```javascript
async function searchYouTubeMusic(query, apiKey) {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=${apiKey}&maxResults=10`);
  const data = await response.json();
  return data.items.map(item => ({
    name: item.snippet.title,
    artist: item.snippet.channelTitle,
    preview_url: null,
    external_url: `https://www.youtube.com/watch?v=${item.id.videoId}`
  }));
}
```

## Implementation Steps

### 1. Update the searchMusicAPI function in app.js:
```javascript
window.searchMusicAPI = async function(query) {
  try {
    // Choose your preferred API
    const token = await getSpotifyToken(); // or getAppleMusicToken()
    return await searchSpotifyMusic(query, token);
  } catch (error) {
    console.error('Music search error:', error);
    return [];
  }
};
```

### 2. Add environment variables for API keys:
Create a `.env` file (don't commit to git):
```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
APPLE_MUSIC_KEY=your_apple_music_key
YOUTUBE_API_KEY=your_youtube_api_key
```

### 3. Update the music selection UI:
Add a search dropdown that shows results from the API and allows users to select from real songs.

## Security Notes

- Never expose API keys in client-side code
- Use a backend proxy to make API calls
- Implement rate limiting to avoid API quota issues
- Cache results to reduce API calls

## Free Alternatives

If you don't want to use paid APIs, consider:
1. **Last.fm API** - Free music metadata
2. **MusicBrainz API** - Open music database
3. **Deezer API** - Free tier available
4. **Jamendo API** - Creative Commons music

## Next Steps

1. Choose your preferred music API
2. Set up developer accounts and get API keys
3. Implement the search functionality
4. Add music playback (30-second previews)
5. Add music sharing to social platforms