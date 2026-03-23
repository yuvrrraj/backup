-- SQL for Delete All Chats Functionality
-- The existing messages table already supports this feature, but here are some additional tables that could be useful

-- 1. Chat deletion logs (optional - to track when users delete all chats)
CREATE TABLE IF NOT EXISTS public.chat_deletion_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  deletion_type TEXT NOT NULL, -- 'single_chat', 'all_chats'
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  messages_count INTEGER DEFAULT 0,
  partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL -- NULL for all_chats deletion
);

-- 2. User preferences table (optional - to store user chat preferences)
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  auto_delete_messages BOOLEAN DEFAULT FALSE,
  auto_delete_days INTEGER DEFAULT 30,
  chat_backup_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Message backups table (optional - to backup messages before deletion)
CREATE TABLE IF NOT EXISTS public.message_backups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  original_message_id UUID NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  original_created_at TIMESTAMPTZ NOT NULL,
  backed_up_at TIMESTAMPTZ DEFAULT NOW(),
  backup_reason TEXT DEFAULT 'user_deletion'
);

-- RLS Policies for new tables

-- Chat deletion logs policies
ALTER TABLE IF EXISTS public.chat_deletion_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own deletion logs" ON public.chat_deletion_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own deletion logs" ON public.chat_deletion_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User preferences policies
ALTER TABLE IF EXISTS public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own preferences" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own preferences" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own preferences" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);

-- Message backups policies
ALTER TABLE IF EXISTS public.message_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their message backups" ON public.message_backups FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "System can insert message backups" ON public.message_backups FOR INSERT WITH CHECK (true); -- Allow system to backup messages

-- Functions for enhanced delete functionality

-- Function to backup messages before deletion
CREATE OR REPLACE FUNCTION backup_messages_before_deletion(p_user_id UUID, p_partner_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  backup_count INTEGER := 0;
BEGIN
  -- Backup messages before deletion
  IF p_partner_id IS NULL THEN
    -- Backup all messages for user
    INSERT INTO public.message_backups (
      original_message_id, sender_id, receiver_id, content, file_url, file_name, file_type, file_size, original_created_at
    )
    SELECT 
      id, sender_id, receiver_id, content, file_url, file_name, file_type, file_size, created_at
    FROM public.messages 
    WHERE sender_id = p_user_id OR receiver_id = p_user_id;
    
    GET DIAGNOSTICS backup_count = ROW_COUNT;
  ELSE
    -- Backup messages for specific chat
    INSERT INTO public.message_backups (
      original_message_id, sender_id, receiver_id, content, file_url, file_name, file_type, file_size, original_created_at
    )
    SELECT 
      id, sender_id, receiver_id, content, file_url, file_name, file_type, file_size, created_at
    FROM public.messages 
    WHERE (sender_id = p_user_id AND receiver_id = p_partner_id) 
       OR (sender_id = p_partner_id AND receiver_id = p_user_id);
    
    GET DIAGNOSTICS backup_count = ROW_COUNT;
  END IF;
  
  RETURN backup_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log chat deletions
CREATE OR REPLACE FUNCTION log_chat_deletion(p_user_id UUID, p_deletion_type TEXT, p_messages_count INTEGER, p_partner_id UUID DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.chat_deletion_logs (user_id, deletion_type, messages_count, partner_id)
  VALUES (p_user_id, p_deletion_type, p_messages_count, p_partner_id)
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced delete function with backup and logging
CREATE OR REPLACE FUNCTION delete_user_messages(p_user_id UUID, p_partner_id UUID DEFAULT NULL, p_backup BOOLEAN DEFAULT TRUE)
RETURNS JSON AS $$
DECLARE
  messages_count INTEGER := 0;
  backup_count INTEGER := 0;
  log_id UUID;
  result JSON;
BEGIN
  -- Count messages to be deleted
  IF p_partner_id IS NULL THEN
    SELECT COUNT(*) INTO messages_count 
    FROM public.messages 
    WHERE sender_id = p_user_id OR receiver_id = p_user_id;
  ELSE
    SELECT COUNT(*) INTO messages_count 
    FROM public.messages 
    WHERE (sender_id = p_user_id AND receiver_id = p_partner_id) 
       OR (sender_id = p_partner_id AND receiver_id = p_user_id);
  END IF;
  
  -- Backup messages if requested
  IF p_backup AND messages_count > 0 THEN
    backup_count := backup_messages_before_deletion(p_user_id, p_partner_id);
  END IF;
  
  -- Delete messages
  IF p_partner_id IS NULL THEN
    DELETE FROM public.messages 
    WHERE sender_id = p_user_id OR receiver_id = p_user_id;
  ELSE
    DELETE FROM public.messages 
    WHERE (sender_id = p_user_id AND receiver_id = p_partner_id) 
       OR (sender_id = p_partner_id AND receiver_id = p_user_id);
  END IF;
  
  -- Log the deletion
  IF p_partner_id IS NULL THEN
    log_id := log_chat_deletion(p_user_id, 'all_chats', messages_count);
  ELSE
    log_id := log_chat_deletion(p_user_id, 'single_chat', messages_count, p_partner_id);
  END IF;
  
  -- Return result
  result := json_build_object(
    'success', true,
    'messages_deleted', messages_count,
    'messages_backed_up', backup_count,
    'log_id', log_id
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION backup_messages_before_deletion(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_chat_deletion(UUID, TEXT, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_messages(UUID, UUID, BOOLEAN) TO authenticated;

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender ON public.messages(receiver_id, sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_deletion_logs_user_id ON public.chat_deletion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_message_backups_user_ids ON public.message_backups(sender_id, receiver_id);

-- Comments
COMMENT ON TABLE public.chat_deletion_logs IS 'Logs when users delete chats for audit purposes';
COMMENT ON TABLE public.user_preferences IS 'User preferences for chat settings';
COMMENT ON TABLE public.message_backups IS 'Backup of messages before deletion';
COMMENT ON FUNCTION delete_user_messages(UUID, UUID, BOOLEAN) IS 'Enhanced function to delete messages with backup and logging';