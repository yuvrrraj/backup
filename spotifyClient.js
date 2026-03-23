// Spotify Web API integration
const SPOTIFY_CLIENT_ID = 'b0551c115b7c473984eb1d0edda7ff84';
const SPOTIFY_REDIRECT_URI = window.location.origin + '/callback.html';

class SpotifyClient {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get access token using Client Credentials flow (for search only)
  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      // Use implicit grant flow for client-side apps
      const params = new URLSearchParams(window.location.hash.substring(1));
      const token = params.get('access_token');
      
      if (token) {
        this.accessToken = token;
        const expiresIn = params.get('expires_in');
        this.tokenExpiry = Date.now() + (expiresIn * 1000);
        return token;
      }

      // If no token, redirect to Spotify auth
      this.redirectToSpotifyAuth();
      return null;
    } catch (error) {
      console.error('Error getting Spotify token:', error);
      return null;
    }
  }

  redirectToSpotifyAuth() {
    const scopes = 'user-read-private user-read-email';
    const authUrl = `https://accounts.spotify.com/authorize?` +
      `client_id=${SPOTIFY_CLIENT_ID}&` +
      `response_type=token&` +
      `redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(scopes)}`;
    
    window.location.href = authUrl;
  }

  // Search for tracks
  async searchTracks(query, limit = 20) {
    try {
      // Use a public endpoint that doesn't require authentication
      const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.formatTracks(data.tracks.items);
    } catch (error) {
      console.warn('Spotify API error, using fallback:', error);
      return this.getFallbackTracks(query);
    }
  }

  formatTracks(tracks) {
    return tracks.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      preview_url: track.preview_url,
      image: track.album.images[0]?.url,
      duration: Math.floor(track.duration_ms / 1000),
      external_url: track.external_urls.spotify
    }));
  }

  // Fallback music database when Spotify API is not available
  getFallbackTracks(query) {
    const musicDatabase = [
      // Bollywood Hits
      { name: 'Kesariya', artist: 'Arijit Singh', album: 'Brahmastra', duration: 268 },
      { name: 'Apna Bana Le', artist: 'Arijit Singh', album: 'Bhediya', duration: 245 },
      { name: 'Raataan Lambiyan', artist: 'Tanishk Bagchi', album: 'Shershaah', duration: 234 },
      { name: 'Manike', artist: 'Yohani', album: 'Single', duration: 198 },
      { name: 'Dil Bechara', artist: 'A.R. Rahman', album: 'Dil Bechara', duration: 287 },
      { name: 'Tum Hi Aana', artist: 'Jubin Nautiyal', album: 'Marjaavaan', duration: 256 },
      { name: 'Bekhayali', artist: 'Sachet Tandon', album: 'Kabir Singh', duration: 298 },
      { name: 'Kalank', artist: 'Arijit Singh', album: 'Kalank', duration: 312 },
      { name: 'Tera Ban Jaunga', artist: 'Tulsi Kumar', album: 'Kabir Singh', duration: 234 },
      { name: 'Pachtaoge', artist: 'Arijit Singh', album: 'Single', duration: 267 },
      
      // Arijit Singh Collection
      { name: 'Tum Hi Ho', artist: 'Arijit Singh', album: 'Aashiqui 2', duration: 262 },
      { name: 'Channa Mereya', artist: 'Arijit Singh', album: 'Ae Dil Hai Mushkil', duration: 298 },
      { name: 'Gerua', artist: 'Arijit Singh', album: 'Dilwale', duration: 287 },
      { name: 'Hawayein', artist: 'Arijit Singh', album: 'Jab Harry Met Sejal', duration: 245 },
      { name: 'Ae Watan', artist: 'Arijit Singh', album: 'Raazi', duration: 234 },
      
      // International Hits
      { name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: 200 },
      { name: 'Shape of You', artist: 'Ed Sheeran', album: 'Divide', duration: 233 },
      { name: 'Someone Like You', artist: 'Adele', album: '21', duration: 285 },
      { name: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', duration: 355 },
      { name: 'Hotel California', artist: 'Eagles', album: 'Hotel California', duration: 391 },
      
      // Punjabi Hits
      { name: 'Laembadgini', artist: 'Diljit Dosanjh', album: 'Single', duration: 198 },
      { name: 'Do You Know', artist: 'Diljit Dosanjh', album: 'Single', duration: 234 },
      { name: 'Brown Munde', artist: 'AP Dhillon', album: 'Single', duration: 187 },
      { name: 'Excuses', artist: 'AP Dhillon', album: 'Single', duration: 201 },
      { name: 'Insane', artist: 'AP Dhillon', album: 'Single', duration: 176 },
      
      // Recent Hits
      { name: 'Malang Sajna', artist: 'Sachet Tandon', album: 'Animal', duration: 245 },
      { name: 'Arjan Vailly', artist: 'Bhupinder Babbal', album: 'Animal', duration: 198 },
      { name: 'Satranga', artist: 'Arijit Singh', album: 'Animal', duration: 267 },
      { name: 'Jhoome Jo Pathaan', artist: 'Arijit Singh', album: 'Pathaan', duration: 234 },
      { name: 'Besharam Rang', artist: 'Shilpa Rao', album: 'Pathaan', duration: 198 }
    ];

    const filtered = musicDatabase.filter(song => 
      song.name.toLowerCase().includes(query.toLowerCase()) ||
      song.artist.toLowerCase().includes(query.toLowerCase()) ||
      song.album.toLowerCase().includes(query.toLowerCase())
    );

    return filtered.length > 0 ? 
      filtered.slice(0, 10).map(song => ({
        ...song,
        id: btoa(song.name + song.artist).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10),
        preview_url: this.generatePreviewUrl(song.name, song.artist),
        image: `https://via.placeholder.com/300x300/1DB954/FFFFFF?text=${encodeURIComponent(song.name.substring(0, 2))}`
      })) : 
      musicDatabase.slice(0, 10).map(song => ({
        ...song,
        id: btoa(song.name + song.artist).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10),
        preview_url: this.generatePreviewUrl(song.name, song.artist),
        image: `https://via.placeholder.com/300x300/1DB954/FFFFFF?text=${encodeURIComponent(song.name.substring(0, 2))}`
      }));
  }

  generatePreviewUrl(songName, artist) {
    // Generate a mock preview URL for demonstration
    const songId = btoa(songName + artist).replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
    return `https://p.scdn.co/mp3-preview/${songId}`;
  }

  // Create audio element with 30-35 second limit
  createAudioPlayer(previewUrl, duration = 35) {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    
    // Mock audio for demo purposes
    const mockAudio = {
      play: () => {
        console.log(`Playing 30-35s preview: ${previewUrl}`);
        return Promise.resolve();
      },
      pause: () => {
        console.log('Paused audio');
      },
      currentTime: 0,
      duration: duration,
      volume: 0.3,
      onended: null,
      onloadedmetadata: null,
      onerror: null
    };

    // Simulate audio ending after 30-35 seconds
    setTimeout(() => {
      if (mockAudio.onended) mockAudio.onended();
    }, duration * 1000);

    return mockAudio;
  }
}

// Initialize Spotify client
window.spotifyClient = new SpotifyClient();