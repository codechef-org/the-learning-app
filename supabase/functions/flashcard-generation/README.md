# Flashcard Generation Edge Function

This Supabase Edge function automatically generates flashcards from completed chat conversations using AI.

## Overview

The function implements a cron-like process that:
1. Finds completed chats that haven't been processed for flashcard generation
2. Extracts meaningful conversations from these chats
3. Uses Gemini AI to generate educational flashcards
4. Stores the flashcards in the database with source tracking

## Environment Variables Required

- `FLASHCARD_CRON_SECRET`: Secret key to authenticate cron requests
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin database access
- `GEMINI_API_KEY`: Google Gemini API key for AI flashcard generation

## Usage

### Manual Trigger
```bash
curl -X POST https://your-project.supabase.co/functions/v1/flashcard-generation \
  -H "X-Secret-Key: your-secret-key" \
  -H "Content-Type: application/json"
```

### Scheduled Cron (Recommended)
Set up a cron job or scheduled task to call this function periodically (e.g., every hour or daily).

## Response Format

```json
{
  "message": "Flashcard generation completed successfully",
  "success": true,
  "stats": {
    "chatsProcessed": 5,
    "flashcardsGenerated": 12
  }
}
```

## Key Features

- **Concurrency Protection**: Prevents multiple instances from running simultaneously
- **Incremental Processing**: Only processes new/updated chats since last run
- **Quality Filtering**: Skips chats with insufficient educational content
- **Error Handling**: Gracefully handles individual chat failures without stopping the entire process
- **Rate Limiting**: Includes delays between API calls to respect rate limits
- **Audit Trail**: Complete tracking of processing status and results

## Processing Logic

1. **Chat Eligibility**: Only processes chats with status 'completed' and sufficient message count
2. **Content Validation**: Requires at least 4 messages with proper user-assistant interaction
3. **AI Generation**: Uses structured prompts to generate up to 5 flashcards per conversation
4. **Flashcard Types**: Supports QnA, Definition, and Cloze deletion flashcard types
5. **Source Tracking**: Links each flashcard to its source chat and message range

## Database Tables Used

- `flashcard_cron_runs`: Tracks each execution of the cron job
- `flashcard_chat_processing`: Records processing status for each chat
- `flashcards`: Stores the generated flashcard content
- `flashcard_sources`: Links flashcards to their source conversations

## Deployment

Deploy this function using the Supabase CLI:

```bash
supabase functions deploy flashcard-generation
```

## Monitoring

Check the function logs in your Supabase dashboard to monitor:
- Execution frequency and duration
- Number of chats processed
- Number of flashcards generated
- Any errors or skipped chats 