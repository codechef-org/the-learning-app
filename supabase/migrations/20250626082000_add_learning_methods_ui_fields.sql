-- Migration: Add UI fields to learning methods
-- This migration adds icon and color columns to learning_methods table

-- Add icon and color columns to learning_methods table
ALTER TABLE learning_methods ADD COLUMN IF NOT EXISTS icon VARCHAR(50) DEFAULT 'help-circle';
ALTER TABLE learning_methods ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#007AFF';

-- Update existing learning methods with appropriate icons and colors
UPDATE learning_methods SET 
    icon = 'help-circle',
    color = '#FF6B6B'
WHERE name = 'Socratic Method';

UPDATE learning_methods SET 
    icon = 'lightbulb',
    color = '#4ECDC4'
WHERE name = 'Feynman Technique';

UPDATE learning_methods SET 
    icon = 'refresh',
    color = '#45B7D1'
WHERE name = 'Active Recall';

UPDATE learning_methods SET 
    icon = 'calendar',
    color = '#96CEB4'
WHERE name = 'Elaborative Learning';

UPDATE learning_methods SET 
    icon = 'message-circle',
    color = '#FECA57'
WHERE name = 'Problem-Based Learning';

UPDATE learning_methods SET 
    icon = 'message-circle',
    color = '#9B59B6'
WHERE name = 'Conversational Learning'; 