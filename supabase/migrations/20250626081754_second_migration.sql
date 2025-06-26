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