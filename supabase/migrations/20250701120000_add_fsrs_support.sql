-- Migration: Add FSRS spaced repetition support
-- Adds columns needed for FSRS algorithm to flashcards table and creates review history

-- Add FSRS columns to flashcards table
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS state VARCHAR(20) DEFAULT 'NEW' CHECK (state IN ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING'));
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS due TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS stability DECIMAL(10,6) DEFAULT 0.4;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS difficulty DECIMAL(10,6) DEFAULT 5.0;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS elapsed_days INTEGER DEFAULT 0;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS scheduled_days INTEGER DEFAULT 0;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS reps INTEGER DEFAULT 0;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS lapses INTEGER DEFAULT 0;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS last_review TIMESTAMP WITH TIME ZONE;
ALTER TABLE flashcards ADD COLUMN IF NOT EXISTS learning_steps INTEGER DEFAULT 0;

-- Create review history table for FSRS
CREATE TABLE IF NOT EXISTS flashcard_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating IN (1, 2, 3, 4)), -- 1=Again, 2=Hard, 3=Good, 4=Easy
    state_before VARCHAR(20) NOT NULL,
    state_after VARCHAR(20) NOT NULL,
    stability_before DECIMAL(10,6),
    stability_after DECIMAL(10,6),
    difficulty_before DECIMAL(10,6),
    difficulty_after DECIMAL(10,6),
    elapsed_days INTEGER NOT NULL,
    scheduled_days INTEGER NOT NULL,
    review_duration_ms INTEGER, -- Time taken to review in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for FSRS functionality
CREATE INDEX IF NOT EXISTS idx_flashcards_state ON flashcards(state);
CREATE INDEX IF NOT EXISTS idx_flashcards_due ON flashcards(due);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_due ON flashcards(user_id, due) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_flashcards_user_state ON flashcards(user_id, state) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_flashcard ON flashcard_reviews(flashcard_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user ON flashcard_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_created_at ON flashcard_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user_created ON flashcard_reviews(user_id, created_at);

-- RLS for review history
ALTER TABLE flashcard_reviews ENABLE ROW LEVEL SECURITY;

-- Policies for review history
CREATE POLICY "Users can view own reviews" ON flashcard_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reviews" ON flashcard_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update existing flashcards to have proper FSRS defaults for new cards
UPDATE flashcards 
SET 
    state = 'NEW',
    due = COALESCE(due, NOW()),
    stability = COALESCE(stability, 0.4),
    difficulty = COALESCE(difficulty, 5.0),
    elapsed_days = COALESCE(elapsed_days, 0),
    scheduled_days = COALESCE(scheduled_days, 0),
    reps = COALESCE(reps, 0),
    lapses = COALESCE(lapses, 0),
    learning_steps = COALESCE(learning_steps, 0)
WHERE state IS NULL; 