-- Migration: Update schema for proper chat functionality
-- This migration fixes column naming and adds missing fields for the chat functionality

-- First, let's add the missing message_order column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_order INTEGER DEFAULT 0;

-- Update the messages table to use chat_session_id instead of chat_id for consistency
-- We'll keep the existing table but create proper relationships

-- Add updated_at column to chat_sessions if it doesn't exist
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create trigger for chat_sessions updated_at
CREATE OR REPLACE TRIGGER update_chat_sessions_updated_at 
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update RLS policies for proper access control
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view messages from own chat sessions" ON messages;
DROP POLICY IF EXISTS "Users can insert messages to own chat sessions" ON messages;

-- Create new policies that work with chat_session_id
-- We need to create a view or update the policies to work with both chat_id and chat_session_id

-- First, let's create a function to check if user owns a chat session
CREATE OR REPLACE FUNCTION user_owns_chat_session(session_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM chat_sessions cs 
        WHERE cs.id = session_id 
        AND (cs.user_id = auth.uid() OR cs.chat_id IN (
            SELECT id FROM chats WHERE user_id = auth.uid()
        ))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new message policies that work with both patterns
CREATE POLICY "Users can view messages from own chats or sessions" ON messages FOR SELECT 
USING (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid()) OR
    chat_id IN (SELECT chat_id FROM chat_sessions WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert messages to own chats or sessions" ON messages FOR INSERT 
WITH CHECK (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid()) OR
    chat_id IN (SELECT chat_id FROM chat_sessions WHERE user_id = auth.uid())
);

-- Add indexes for better performance with message_order
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_order ON messages(chat_id, message_order);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- Insert some sample data for testing (optional)
-- This will help ensure the learning methods are available
INSERT INTO learning_methods (name, system_prompt, description) VALUES
(
    'Conversational Learning',
    'You are a friendly and knowledgeable tutor. Engage in natural conversation with the student about their topic of interest. Ask follow-up questions, provide explanations, and encourage exploration of the subject matter through dialogue.',
    'Learn through natural conversation and dialogue'
);

-- Update existing learning methods to ensure they have proper descriptions
UPDATE learning_methods SET description = 'Learn through guided questioning and critical thinking' 
WHERE name = 'Socratic Method' AND (description IS NULL OR description = '');

UPDATE learning_methods SET description = 'Learn by explaining concepts in simple, clear language' 
WHERE name = 'Feynman Technique' AND (description IS NULL OR description = '');

UPDATE learning_methods SET description = 'Learn through active retrieval and testing of knowledge' 
WHERE name = 'Active Recall' AND (description IS NULL OR description = '');

UPDATE learning_methods SET description = 'Learn by connecting new concepts to existing knowledge' 
WHERE name = 'Elaborative Learning' AND (description IS NULL OR description = '');

UPDATE learning_methods SET description = 'Learn through solving real-world problems and applications' 
WHERE name = 'Problem-Based Learning' AND (description IS NULL OR description = ''); 