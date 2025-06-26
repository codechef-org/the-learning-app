-- Migration: Update schema for proper chat functionality
-- This migration fixes column naming and adds missing fields for the chat functionality

-- First, let's add the missing message_order column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_order INTEGER DEFAULT 0;


-- First, let's create a function to check if user owns a chat
CREATE OR REPLACE FUNCTION user_owns_chat(chat_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM chats cs 
        WHERE cs.id = session_id 
        AND cs.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for better performance with message_order
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_order ON messages(chat_id, message_order);
