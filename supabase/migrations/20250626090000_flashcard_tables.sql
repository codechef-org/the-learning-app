-- Migration: Flashcard generation tables
-- Creates tables for automated flashcard generation from chat history

-- Flashcard cron runs table
-- Tracks each run of the flashcard generation process
CREATE TABLE flashcard_cron_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    processed_up_to_timestamp TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    total_chats_processed INTEGER DEFAULT 0,
    total_flashcards_generated INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flashcard chat processing table
-- Tracks processing status for each chat in each cron run
CREATE TABLE flashcard_chat_processing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cron_run_id UUID NOT NULL REFERENCES flashcard_cron_runs(id) ON DELETE CASCADE,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    last_processed_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'processed' CHECK (status IN ('processed', 'failed', 'skipped', 'processing')),
    flashcards_generated INTEGER DEFAULT 0,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT
);

-- Flashcards table
-- Stores the actual flashcard content
CREATE TABLE flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('QnA', 'Definition', 'Cloze')),
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    tags TEXT[], -- Array of AI generated tags
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flashcard sources table
-- Links flashcards to their source chat and message range
CREATE TABLE flashcard_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    start_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    end_message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_flashcard_cron_runs_status ON flashcard_cron_runs(status);
CREATE INDEX idx_flashcard_cron_runs_start_time ON flashcard_cron_runs(start_time);

CREATE INDEX idx_flashcard_chat_processing_cron_run ON flashcard_chat_processing(cron_run_id);
CREATE INDEX idx_flashcard_chat_processing_chat ON flashcard_chat_processing(chat_id);
CREATE INDEX idx_flashcard_chat_processing_status ON flashcard_chat_processing(status);

CREATE INDEX idx_flashcards_user_id ON flashcards(user_id);
CREATE INDEX idx_flashcards_type ON flashcards(type);
CREATE INDEX idx_flashcards_is_deleted ON flashcards(is_deleted);
CREATE INDEX idx_flashcards_created_at ON flashcards(created_at);
CREATE INDEX idx_flashcards_tags ON flashcards USING GIN(tags);

CREATE INDEX idx_flashcard_sources_flashcard ON flashcard_sources(flashcard_id);
CREATE INDEX idx_flashcard_sources_chat ON flashcard_sources(chat_id);

-- Triggers for auto-updating updated_at columns
CREATE TRIGGER update_flashcard_cron_runs_updated_at BEFORE UPDATE ON flashcard_cron_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flashcards_updated_at BEFORE UPDATE ON flashcards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE flashcard_cron_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_chat_processing ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_sources ENABLE ROW LEVEL SECURITY;

-- Cron runs policies (admin access only - you may want to adjust this)
-- For now, allowing authenticated users to view cron runs for debugging
CREATE POLICY "Authenticated users can view cron runs" ON flashcard_cron_runs FOR SELECT TO authenticated USING (true);

-- Chat processing policies (users can see processing status for their own chats)
CREATE POLICY "Users can view processing for own chats" ON flashcard_chat_processing FOR SELECT 
USING (chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid()));

-- Flashcard policies (users can only access their own flashcards)
CREATE POLICY "Users can view own flashcards" ON flashcards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own flashcards" ON flashcards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own flashcards" ON flashcards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own flashcards" ON flashcards FOR DELETE USING (auth.uid() = user_id);

-- Flashcard sources policies (users can view sources for their own flashcards)
CREATE POLICY "Users can view sources for own flashcards" ON flashcard_sources FOR SELECT 
USING (flashcard_id IN (SELECT id FROM flashcards WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert sources for own flashcards" ON flashcard_sources FOR INSERT 
WITH CHECK (flashcard_id IN (SELECT id FROM flashcards WHERE user_id = auth.uid())); 