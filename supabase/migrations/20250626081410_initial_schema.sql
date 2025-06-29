-- Migration: Initial schema for AI Learning App
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: Supabase provides auth.users table automatically
-- We'll reference auth.users(id) for user relationships

-- Learning methods table
-- Each method has a name and system prompt for the AI
CREATE TABLE learning_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    system_prompt TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    icon VARCHAR(50) DEFAULT 'help-circle',
    color VARCHAR(7) DEFAULT '#007AFF',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chats table
-- Individual learning sessions that can be marked as done
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    learning_method_id UUID REFERENCES learning_methods(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    topic VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Messages table
-- Individual messages within each chat (user and AI responses)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    metadata JSONB, -- For storing additional data like tokens, model used, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_chats_created_at ON chats(created_at);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating updated_at columns
-- Note: No trigger needed for auth.users as it's managed by Supabase

CREATE TRIGGER update_learning_methods_updated_at BEFORE UPDATE ON learning_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- RLS (Row Level Security) policies for Supabase
-- Note: auth.users table RLS is managed by Supabase automatically
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Chats policies
CREATE POLICY "Users can view own chats" ON chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chats" ON chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chats" ON chats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own chats" ON chats FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages from own chats" ON messages FOR SELECT 
USING (chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert messages to own chats" ON messages FOR INSERT 
WITH CHECK (chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid()));


-- Learning methods are public (read-only for all authenticated users)
CREATE POLICY "Anyone can view learning methods" ON learning_methods FOR SELECT TO authenticated USING (true); 