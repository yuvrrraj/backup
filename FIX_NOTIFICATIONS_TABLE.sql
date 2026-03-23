-- Create notifications table and fix follow functionality
-- Run this in your Supabase SQL Editor

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their notifications" ON public.notifications 
  FOR SELECT USING (auth.uid() = to_user_id);

CREATE POLICY "Users can create notifications" ON public.notifications 
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update their notifications" ON public.notifications 
  FOR UPDATE USING (auth.uid() = to_user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_notifications_to_user ON public.notifications(to_user_id);

-- Simple follow notification function (without complex logic)
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (to_user_id, from_user_id, type)
  VALUES (NEW.followee_id, NEW.follower_id, 'follow');
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- If notification fails, still allow the follow to succeed
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS follow_notification_trigger ON public.follows;
CREATE TRIGGER follow_notification_trigger
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION create_follow_notification();