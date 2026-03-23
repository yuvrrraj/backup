-- Create reels table for storing video reels
CREATE TABLE IF NOT EXISTS public.reels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  duration INTEGER, -- Duration in seconds
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reels_user_id ON public.reels(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_created_at ON public.reels(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reels_audience ON public.reels(audience);
CREATE INDEX IF NOT EXISTS idx_reels_views ON public.reels(views_count DESC);

-- Create reels_likes table for tracking likes on reels
CREATE TABLE IF NOT EXISTS public.reels_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reel_id, user_id)
);

-- Enable RLS for reels_likes table
ALTER TABLE public.reels_likes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reels_likes
CREATE POLICY "Reel likes are viewable by everyone" ON public.reels_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reel likes" ON public.reels_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reel likes" ON public.reels_likes FOR DELETE USING (auth.uid() = user_id);

-- Create reels_comments table for comments on reels
CREATE TABLE IF NOT EXISTS public.reels_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for reels_comments table
ALTER TABLE public.reels_comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reels_comments
CREATE POLICY "Reel comments are viewable by everyone" ON public.reels_comments FOR SELECT USING (true);
CREATE POLICY "Users can insert their own reel comments" ON public.reels_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own reel comments" ON public.reels_comments FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for reels_likes and reels_comments
CREATE INDEX IF NOT EXISTS idx_reels_likes_reel_id ON public.reels_likes(reel_id);
CREATE INDEX IF NOT EXISTS idx_reels_likes_user_id ON public.reels_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_comments_reel_id ON public.reels_comments(reel_id);
CREATE INDEX IF NOT EXISTS idx_reels_comments_created_at ON public.reels_comments(created_at DESC);

-- Create function to update reels counts
CREATE OR REPLACE FUNCTION update_reels_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'reels_likes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.reels 
      SET likes_count = likes_count + 1 
      WHERE id = NEW.reel_id;
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.reels 
      SET likes_count = GREATEST(likes_count - 1, 0) 
      WHERE id = OLD.reel_id;
      RETURN OLD;
    END IF;
  ELSIF TG_TABLE_NAME = 'reels_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.reels 
      SET comments_count = comments_count + 1 
      WHERE id = NEW.reel_id;
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.reels 
      SET comments_count = GREATEST(comments_count - 1, 0) 
      WHERE id = OLD.reel_id;
      RETURN OLD;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update counts
CREATE TRIGGER trigger_update_reels_likes_count
  AFTER INSERT OR DELETE ON public.reels_likes
  FOR EACH ROW EXECUTE FUNCTION update_reels_counts();

CREATE TRIGGER trigger_update_reels_comments_count
  AFTER INSERT OR DELETE ON public.reels_comments
  FOR EACH ROW EXECUTE FUNCTION update_reels_counts();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_reels_updated_at
  BEFORE UPDATE ON public.reels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();