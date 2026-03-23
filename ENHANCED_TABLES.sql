-- Enhanced Instagram-like Features Database Tables
-- Run this SQL in your Supabase SQL Editor after the main setup

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_user UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_user UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('follow', 'like', 'comment', 'follow_request', 'mention')),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved posts table
CREATE TABLE IF NOT EXISTS public.saved_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Reports table for content moderation
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User reports table
CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reported_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Close friends table
CREATE TABLE IF NOT EXISTS public.close_friends (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Story views table
CREATE TABLE IF NOT EXISTS public.story_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, viewer_id)
);

-- Add location column to posts if not exists
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS location TEXT;

-- Add hidden column for content moderation
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE;

-- Add admin flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add verification badge
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Add last seen for online status
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- RLS Policies for new tables

-- Notifications policies
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (auth.uid() = to_user);
CREATE POLICY "Users can create notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = from_user);
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE USING (auth.uid() = to_user);

-- Saved posts policies
CREATE POLICY "Users can view their saved posts" ON public.saved_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save posts" ON public.saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave posts" ON public.saved_posts FOR DELETE USING (auth.uid() = user_id);

-- Reports policies
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can view all reports" ON public.reports FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- User reports policies
CREATE POLICY "Users can create user reports" ON public.user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can view all user reports" ON public.user_reports FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  )
);

-- Close friends policies
CREATE POLICY "Users can manage their close friends" ON public.close_friends FOR ALL USING (auth.uid() = user_id);

-- Story views policies
CREATE POLICY "Story views are viewable by story owner" ON public.story_views FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.stories 
    WHERE id = story_id AND user_id = auth.uid()
  )
);
CREATE POLICY "Users can view stories" ON public.story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- Enable RLS on new tables
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.close_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_to_user ON public.notifications(to_user, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_from_user ON public.notifications(from_user);
CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON public.saved_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_views_story ON public.story_views(story_id);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON public.profiles(last_seen DESC);

-- Functions for automatic notifications
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send notification if it's a new follow (not an update)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (to_user, from_user, type)
    VALUES (NEW.followee_id, NEW.follower_id, 
      CASE WHEN NEW.approved THEN 'follow' ELSE 'follow_request' END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for follow notifications
DROP TRIGGER IF EXISTS trigger_follow_notification ON public.follows;
CREATE TRIGGER trigger_follow_notification
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

-- Function to update last seen
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles 
  SET last_seen = NOW() 
  WHERE id = auth.uid();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Update user activity on various actions
CREATE OR REPLACE FUNCTION track_user_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles 
  SET last_seen = NOW() 
  WHERE id = COALESCE(NEW.user_id, NEW.sender_id, auth.uid());
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers for activity tracking
DROP TRIGGER IF EXISTS trigger_activity_posts ON public.posts;
CREATE TRIGGER trigger_activity_posts
  AFTER INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION track_user_activity();

DROP TRIGGER IF EXISTS trigger_activity_messages ON public.messages;
CREATE TRIGGER trigger_activity_messages
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION track_user_activity();

-- Function to clean up expired stories
CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS void AS $$
BEGIN
  DELETE FROM public.stories 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (run this manually or set up a cron job)
-- SELECT cleanup_expired_stories();

COMMIT;