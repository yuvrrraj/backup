-- Create reels table for storing video reels
CREATE TABLE IF NOT EXISTS public.reels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  duration INTEGER,
  audience TEXT DEFAULT 'public',
  music_name TEXT,
  music_artist TEXT,
  music_url TEXT,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for reels table
ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reels
CREATE POLICY "Reels are viewable by everyone" ON public.reels FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reels" ON public.reels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reels" ON public.reels FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reels" ON public.reels FOR DELETE USING (auth.uid() = user_id);

-- Create reels_likes table
CREATE TABLE IF NOT EXISTS public.reels_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reel_id, user_id)
);

-- Enable RLS for reels_likes
ALTER TABLE public.reels_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reel likes are viewable by everyone" ON public.reels_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reel likes" ON public.reels_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reel likes" ON public.reels_likes FOR DELETE USING (auth.uid() = user_id);

-- Create reels_comments table
CREATE TABLE IF NOT EXISTS public.reels_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for reels_comments
ALTER TABLE public.reels_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reel comments are viewable by everyone" ON public.reels_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reel comments" ON public.reels_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reel comments" ON public.reels_comments FOR DELETE USING (auth.uid() = user_id);