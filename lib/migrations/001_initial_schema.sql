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

-- Flashcards table
-- Generated from completed chats for spaced repetition learning
CREATE TABLE flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
    front TEXT NOT NULL, -- Question/prompt
    back TEXT NOT NULL, -- Answer/explanation
    difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    ease_factor DECIMAL(3,2) DEFAULT 2.5, -- For spaced repetition algorithm
    interval_days INTEGER DEFAULT 1, -- Days until next review
    repetition_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    tags TEXT[], -- Array of tags for categorization
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flashcard reviews table
-- Track user performance with spaced repetition
CREATE TABLE flashcard_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flashcard_id UUID REFERENCES flashcards(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    quality INTEGER NOT NULL CHECK (quality BETWEEN 0 AND 5), -- 0=complete blackout, 5=perfect recall
    review_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_seconds INTEGER, -- Time taken to respond
    previous_interval_days INTEGER,
    new_interval_days INTEGER,
    ease_factor_before DECIMAL(3,2),
    ease_factor_after DECIMAL(3,2)
);

-- Chat sessions table (optional - for tracking learning sessions)
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    message_count INTEGER DEFAULT 0
);

-- Indexes for better performance
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_chats_created_at ON chats(created_at);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_flashcards_user_id ON flashcards(user_id);
CREATE INDEX idx_flashcards_chat_id ON flashcards(chat_id);
CREATE INDEX idx_flashcards_is_active ON flashcards(is_active);
CREATE INDEX idx_flashcard_reviews_flashcard_id ON flashcard_reviews(flashcard_id);
CREATE INDEX idx_flashcard_reviews_user_id ON flashcard_reviews(user_id);
CREATE INDEX idx_flashcard_reviews_review_date ON flashcard_reviews(review_date);

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

CREATE TRIGGER update_flashcards_updated_at BEFORE UPDATE ON flashcards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate next review date for spaced repetition
CREATE OR REPLACE FUNCTION calculate_next_review_date(
    current_ease_factor DECIMAL,
    current_interval INTEGER,
    quality INTEGER
)
RETURNS TABLE(
    new_ease_factor DECIMAL,
    new_interval INTEGER,
    next_review_date TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    ease DECIMAL := current_ease_factor;
    interval_days INTEGER := current_interval;
BEGIN
    -- SM-2 Algorithm implementation
    IF quality >= 3 THEN
        -- Correct response
        IF interval_days = 1 THEN
            interval_days := 6;
        ELSIF interval_days = 6 THEN
            interval_days := 15;
        ELSE
            interval_days := ROUND(interval_days * ease);
        END IF;
        
        ease := ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    ELSE
        -- Incorrect response - reset interval
        interval_days := 1;
    END IF;
    
    -- Ensure ease factor doesn't go below 1.3
    IF ease < 1.3 THEN
        ease := 1.3;
    END IF;
    
    RETURN QUERY SELECT 
        ease,
        interval_days,
        (NOW() + (interval_days || ' days')::INTERVAL);
END;
$$ LANGUAGE plpgsql;

-- Insert some default learning methods
INSERT INTO learning_methods (name, system_prompt, description) VALUES
(
    'Socratic Method',
    'You are a Socratic tutor. Instead of directly providing answers, guide the student to discover knowledge through thoughtful questions. Ask probing questions that help them think critically and arrive at conclusions themselves. Encourage deep thinking and self-reflection.',
    'Learn through guided questioning and critical thinking'
),
(
    'Feynman Technique',
    'You are a tutor using the Feynman Technique. Help the student explain concepts in simple terms as if teaching a child. When they struggle to explain something simply, guide them to identify gaps in their understanding and help them fill those gaps.',
    'Learn by explaining concepts in simple, clear language'
),
(
    'Active Recall',
    'You are a tutor focused on active recall. Present information, then immediately test the student''s understanding through questions and scenarios. Encourage them to retrieve information from memory rather than just reading passively.',
    'Learn through active retrieval and testing of knowledge'
),
(
    'Elaborative Learning',
    'You are a tutor who helps students connect new information to existing knowledge. Encourage them to find relationships, create analogies, and build upon what they already know. Help them create rich mental models.',
    'Learn by connecting new concepts to existing knowledge'
),
(
    'Problem-Based Learning',
    'You are a tutor who presents real-world problems for the student to solve. Guide them through the problem-solving process, helping them apply theoretical knowledge to practical situations.',
    'Learn through solving real-world problems and applications'
);

-- RLS (Row Level Security) policies for Supabase
-- Note: auth.users table RLS is managed by Supabase automatically
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

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

-- Flashcards policies
CREATE POLICY "Users can view own flashcards" ON flashcards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own flashcards" ON flashcards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own flashcards" ON flashcards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own flashcards" ON flashcards FOR DELETE USING (auth.uid() = user_id);

-- Flashcard reviews policies
CREATE POLICY "Users can view own reviews" ON flashcard_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reviews" ON flashcard_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Chat sessions policies
CREATE POLICY "Users can view own chat sessions" ON chat_sessions FOR SELECT 
USING (chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own chat sessions" ON chat_sessions FOR INSERT 
WITH CHECK (chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own chat sessions" ON chat_sessions FOR UPDATE 
USING (chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid()));

-- Learning methods are public (read-only for all authenticated users)
CREATE POLICY "Anyone can view learning methods" ON learning_methods FOR SELECT TO authenticated USING (true); 