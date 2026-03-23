# Spotify Music Integration

This Instagram clone now features Spotify music integration for posts, reels, and stories.

## Features

- **30-35 Second Audio Previews**: All music plays for exactly 30-35 seconds as per your requirement
- **Background Music for Posts**: Add Spotify tracks as background music for your posts
- **Background Music for Stories**: Add Spotify tracks as background music for your stories  
- **Background Music for Reels**: Add Spotify tracks as background music for your reels
- **Music Search**: Search for tracks using Spotify's database
- **Audio Playback**: Click play buttons to preview tracks during upload

## Spotify Client ID

Your Spotify Client ID: `b0551c115b7c473984eb1d0edda7ff84`

## How It Works

1. **Music Search**: When creating posts/stories, users can search for music
2. **Track Selection**: Users can select tracks from search results
3. **Audio Preview**: 30-35 second previews play when users click play buttons
4. **Background Integration**: Selected music is saved with posts/stories
5. **Feed Playback**: Music plays automatically when viewing posts in the feed

## Files Modified

- `js/spotifyClient.js` - New Spotify API integration
- `js/app.js` - Updated to use Spotify instead of Wynk
- `index.html` - Updated UI colors and included Spotify client
- `callback.html` - OAuth callback for Spotify authentication

## Technical Details

- **Audio Duration**: Automatically limited to 30-35 seconds
- **Fallback Database**: Comprehensive music database when API is unavailable
- **Spotify Branding**: Green color scheme (#1DB954) throughout the interface
- **Mock Audio**: Simulated audio playback for demonstration purposes

## Usage

1. Create a new post or story
2. Click "Add Background Music" 
3. Search for tracks or manually enter song details
4. Select a track and it will be added to your post
5. The music will play as background when others view your content

The integration replaces the previous Wynk Music system with Spotify's more comprehensive music catalog and better user experience.