-- Create groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Create group_messages table
CREATE TABLE IF NOT EXISTS public.group_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups
CREATE POLICY "Users can view groups they are members of" ON public.groups FOR SELECT USING (
  id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Group admins can update groups" ON public.groups FOR UPDATE USING (
  id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid() AND role = 'admin')
);

-- RLS Policies for group_members
CREATE POLICY "Users can view group members of their groups" ON public.group_members FOR SELECT USING (
  group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
);
CREATE POLICY "Group admins can manage members" ON public.group_members FOR ALL USING (
  group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid() AND role = 'admin')
);

-- RLS Policies for group_messages
CREATE POLICY "Users can view messages in their groups" ON public.group_messages FOR SELECT USING (
  group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
);
CREATE POLICY "Group members can send messages" ON public.group_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
);