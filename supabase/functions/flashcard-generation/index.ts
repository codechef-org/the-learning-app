import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  message_order: number;
  created_at: string;
}

interface GeneratedFlashcard {
  type: 'qa' | 'definition' | 'cloze';
  front: string;
  back: string;
  tags: string[];
}

interface FlashcardGenerationResponse {
  flashcards: GeneratedFlashcard[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check for secret key to prevent unauthorized access
    const secretKey = req.headers.get('X-Secret-Key')
    const expectedSecret = Deno.env.get('FLASHCARD_CRON_SECRET')
    
    if (!secretKey || !expectedSecret || secretKey !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid secret key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key for admin access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting flashcard generation cron...')

    // 1. Check for existing running cron jobs
    const { data: runningJobs, error: runningJobsError } = await supabaseClient
      .from('flashcard_cron_runs')
      .select('id')
      .eq('status', 'running')
    
    if (runningJobsError) {
      throw new Error(`Failed to check running jobs: ${runningJobsError.message}`)
    }

    if (runningJobs && runningJobs.length > 0) {
      return new Response(
        JSON.stringify({ 
          message: 'Flashcard generation already running',
          success: true,
          skipped: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Create new cron run entry
    const { data: cronRun, error: cronRunError } = await supabaseClient
      .from('flashcard_cron_runs')
      .insert({
        status: 'running',
        start_time: new Date().toISOString()
      })
      .select('id')
      .single()

    if (cronRunError || !cronRun) {
      throw new Error(`Failed to create cron run: ${cronRunError?.message}`)
    }

    const cronRunId = cronRun.id
    let totalChatsProcessed = 0
    let totalFlashcardsGenerated = 0

    try {
      // 3. Get last processed timestamp
      const { data: lastRun } = await supabaseClient
        .from('flashcard_cron_runs')
        .select('processed_up_to_timestamp')
        .eq('status', 'completed')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      const lastProcessedTimestamp = lastRun?.processed_up_to_timestamp || 
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago default

      // 4. Set processing window (5 minutes ago to avoid active chats)
      const processingEndTime = new Date(Date.now() - 5 * 60 * 1000).toISOString()

      console.log(`Processing chats updated between ${lastProcessedTimestamp} and ${processingEndTime}`)

      // 5. Find eligible chats
      const { data: eligibleChats, error: chatsError } = await supabaseClient
        .from('chats')
        .select(`
          id, user_id, title, topic, updated_at,
          messages!inner(id, created_at)
        `)
        .gt('updated_at', lastProcessedTimestamp)
        .lte('updated_at', processingEndTime)

      if (chatsError) {
        throw new Error(`Failed to fetch eligible chats: ${chatsError.message}`)
      }

      if (!eligibleChats || eligibleChats.length === 0) {
        console.log('No eligible chats found for processing')
        
        // Update cron run as completed
        await supabaseClient
          .from('flashcard_cron_runs')
          .update({
            end_time: new Date().toISOString(),
            processed_up_to_timestamp: processingEndTime,
            status: 'completed',
            total_chats_processed: 0,
            total_flashcards_generated: 0
          })
          .eq('id', cronRunId)

        return new Response(
          JSON.stringify({ 
            message: 'No eligible chats found for processing',
            success: true,
            stats: { chatsProcessed: 0, flashcardsGenerated: 0 }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 6. Process each chat
      for (const chat of eligibleChats) {
        try {
          const chatFlashcards = await processChat(supabaseClient, chat, cronRunId, lastProcessedTimestamp, processingEndTime)
          totalChatsProcessed++
          totalFlashcardsGenerated += chatFlashcards
          
          // Add delay between chats to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
          
        } catch (error) {
          console.error(`Error processing chat ${chat.id}:`, error)
          
          // Record failed chat processing
          await supabaseClient
            .from('flashcard_chat_processing')
            .insert({
              cron_run_id: cronRunId,
              chat_id: chat.id,
              status: 'failed',
              error_message: error.message,
              flashcards_generated: 0,
              processed_at: new Date().toISOString()
            })
        }
      }

      // 7. Update cron run as completed
      await supabaseClient
        .from('flashcard_cron_runs')
        .update({
          end_time: new Date().toISOString(),
          processed_up_to_timestamp: processingEndTime,
          status: 'completed',
          total_chats_processed: totalChatsProcessed,
          total_flashcards_generated: totalFlashcardsGenerated
        })
        .eq('id', cronRunId)

      console.log(`Flashcard generation completed. Processed ${totalChatsProcessed} chats, generated ${totalFlashcardsGenerated} flashcards`)

      return new Response(
        JSON.stringify({ 
          message: 'Flashcard generation completed successfully',
          success: true,
          stats: {
            chatsProcessed: totalChatsProcessed,
            flashcardsGenerated: totalFlashcardsGenerated
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (error) {
      // Update cron run as failed
      await supabaseClient
        .from('flashcard_cron_runs')
        .update({
          end_time: new Date().toISOString(),
          status: 'failed',
          error_message: error.message,
          total_chats_processed: totalChatsProcessed,
          total_flashcards_generated: totalFlashcardsGenerated
        })
        .eq('id', cronRunId)

      throw error
    }

  } catch (error) {
    console.error('Error in flashcard-generation function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

async function processChat(
  supabaseClient: any,
  chat: any,
  cronRunId: string,
  lastProcessedTimestamp: string,
  processingEndTime: string
): Promise<number> {
  console.log(`Processing chat: ${chat.id} - ${chat.title}`)

  // 1. Create chat processing record
  const { data: chatProcessing, error: processingError } = await supabaseClient
    .from('flashcard_chat_processing')
    .insert({
      cron_run_id: cronRunId,
      chat_id: chat.id,
      status: 'processing'
    })
    .select('id')
    .single()

  if (processingError) {
    throw new Error(`Failed to create chat processing record: ${processingError.message}`)
  }

  // 2. Get last processed message for this chat
  const { data: lastProcessedMessage } = await supabaseClient
    .from('flashcard_chat_processing')
    .select(`
      last_processed_message_id,
      messages!flashcard_chat_processing_last_processed_message_id_fkey(created_at)
    `)
    .eq('chat_id', chat.id)
    .eq('status', 'processed')
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastProcessedMessageTime = lastProcessedMessage?.messages?.created_at || '1970-01-01T00:00:00Z'

  // 3. Get messages to process
  const { data: messages, error: messagesError } = await supabaseClient
    .from('messages')
    .select('id, content, role, message_order, created_at')
    .eq('chat_id', chat.id)
    .gt('created_at', lastProcessedMessageTime)
    .lte('created_at', processingEndTime)
    .in('role', ['user', 'assistant'])
    .order('message_order', { ascending: true })

  if (messagesError) {
    throw new Error(`Failed to fetch messages: ${messagesError.message}`)
  }

  if (!messages || messages.length < 4) {
    // Skip chats with too few messages
    await supabaseClient
      .from('flashcard_chat_processing')
      .update({
        status: 'skipped',
        error_message: 'Insufficient messages for flashcard generation',
        flashcards_generated: 0,
        processed_at: new Date().toISOString()
      })
      .eq('id', chatProcessing.id)
    
    console.log(`Skipped chat ${chat.id}: insufficient messages (${messages.length})`)
    return 0
  }

  // 4. Validate conversation has both user and assistant messages
  const userMessages = messages.filter(m => m.role === 'user')
  const assistantMessages = messages.filter(m => m.role === 'assistant')

  if (userMessages.length < 2 || assistantMessages.length < 2) {
    await supabaseClient
      .from('flashcard_chat_processing')
      .update({
        status: 'skipped',
        error_message: 'Insufficient user-assistant interaction',
        flashcards_generated: 0,
        processed_at: new Date().toISOString()
      })
      .eq('id', chatProcessing.id)
    
    console.log(`Skipped chat ${chat.id}: insufficient user-assistant interaction`)
    return 0
  }

  // 5. Generate flashcards using AI
  const flashcards = await generateFlashcardsWithAI(chat, messages)

  if (!flashcards || flashcards.length === 0) {
    await supabaseClient
      .from('flashcard_chat_processing')
      .update({
        status: 'processed',
        last_processed_message_id: messages[messages.length - 1].id,
        flashcards_generated: 0,
        processed_at: new Date().toISOString()
      })
      .eq('id', chatProcessing.id)
    
    console.log(`No flashcards generated for chat ${chat.id}`)
    return 0
  }

  // 6. Store flashcards in database
  let flashcardsStored = 0
  for (const flashcard of flashcards) {
    try {
      // Insert flashcard
      const { data: newFlashcard, error: flashcardError } = await supabaseClient
        .from('flashcards')
        .insert({
          user_id: chat.user_id,
          type: flashcard.type,
          front: flashcard.front,
          back: flashcard.back,
          tags: flashcard.tags,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (flashcardError) {
        console.error(`Error storing flashcard: ${flashcardError.message}`)
        continue
      }

      // Link to source
      const { error: sourceError } = await supabaseClient
        .from('flashcard_sources')
        .insert({
          flashcard_id: newFlashcard.id,
          chat_id: chat.id,
          start_message_id: messages[0].id,
          end_message_id: messages[messages.length - 1].id,
          created_at: new Date().toISOString()
        })

      if (sourceError) {
        console.error(`Error storing flashcard source: ${sourceError.message}`)
        // Don't delete the flashcard, just log the error
      }

      flashcardsStored++
    } catch (error) {
      console.error(`Error processing flashcard:`, error)
    }
  }

  // 7. Update chat processing status
  await supabaseClient
    .from('flashcard_chat_processing')
    .update({
      status: 'processed',
      last_processed_message_id: messages[messages.length - 1].id,
      flashcards_generated: flashcardsStored,
      processed_at: new Date().toISOString()
    })
    .eq('id', chatProcessing.id)

  console.log(`Generated ${flashcardsStored} flashcards for chat ${chat.id}`)
  return flashcardsStored
}

async function generateFlashcardsWithAI(chat: any, messages: ChatMessage[]): Promise<GeneratedFlashcard[]> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  // Format conversation for AI
  const conversation = messages.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')
  
  // Calculate conversation duration
  const firstMessage = new Date(messages[0].created_at)
  const lastMessage = new Date(messages[messages.length - 1].created_at)
  const durationMinutes = Math.round((lastMessage.getTime() - firstMessage.getTime()) / (1000 * 60))

  const prompt = `You are an expert in cognitive science and learning, specializing in creating optimal retrieval practice prompts. Your mission is to convert a conversation transcript into a set of high-quality, atomic flashcards that adhere to the principles of effective learning.

**Core Guiding Principles:**
1.  **Focused and Atomic:** Each flashcard must test only ONE discrete piece of information (a single fact, concept, or step). This is the most important rule.
2.  **Precise and Unambiguous:** The "front" of the card must be a question or cue that leads to a single, specific, and consistent correct answer. Avoid vague questions that could have multiple valid answers.
3.  **Tractable yet Effortful:** The prompt should require genuine memory retrieval (be effortful), but not be so complex or obscure that it's impossible to answer (be tractable). It should be a challenge, not a source of frustration.
4.  **No Trivial Inference:** The answer on the "back" should not be easily guessable from the wording of the "front." The user must access their memory, not just use logic.

**Your Task:**
1.  Analyze the provided conversation between a 'User' and an 'AI Tutor'.
2.  **Source-Grounding is Your Top Priority:** Every single flashcard (both the "front" and "back") must be derived *exclusively* from the information explicitly stated within the provided transcript. The answer to every question must be verifiable within the AI Tutor's messages.
3.  **Do Not Introduce External Knowledge:** If a concept is only partially explained, create a flashcard only for the explained part. Do not use your own general knowledge to complete or add information that was not in the original discussion. Your role is to be a faithful extractor and formatter of the learned material.
4.  **Decompose and Create:** After identifying a source-grounded concept, decompose it into its smallest logical, testable component and create a flashcard in the most appropriate format.
5.  **Generate Topic Tags:** Create relevant tags based on the subject matter of the flashcard.
6.  **AVOID:** Creating overly broad questions like "Summarize X" or "Explain everything about Y."

**Flashcard Types:**
*   **"qa":** For a standard Question/Answer. Ideal for cause-and-effect, "why," or "how" questions.
*   **"definition":** For key terms. The "front" is the term, the "back" is the precise definition.
*   **"cloze":** For fill-in-the-blank. Excellent for making prompts tractable and testing key vocabulary within context. Use the format "Sentence with the {{c1::key term}} removed."

**Output Format:**
Return your response as a single JSON array of flashcard objects. Adhere strictly to this format. Do not include any explanatory text outside the JSON structure.

**Example JSON Output:**
[
  {
    "type": "qa",
    "front": "What are the two primary INPUTS for the light-dependent reactions in photosynthesis?",
    "back": "Water (H₂O) and light energy.",
    "tags": ["biology", "photosynthesis", "light-reactions"]
  },
  {
    "type": "qa",
    "front": "What is the main OUTPUT of the Calvin Cycle (light-independent reactions)?",
    "back": "Glucose (a sugar/carbohydrate).",
    "tags": ["biology", "photosynthesis", "calvin-cycle"]
  },
  {
    "type": "definition",
    "front": "Retrieval-Induced Forgetting",
    "back": "A memory phenomenon where remembering one item from a category inhibits the ability to recall other, related items from the same category that were not retrieved.",
    "tags": ["cognitive-science", "memory"]
  },
  {
    "type": "cloze",
    "front": "In the context of retrieval practice, prompts should be difficult enough to be {{c1::effortful}}, but not so hard they become frustrating.",
    "back": "In the context of retrieval practice, prompts should be difficult enough to be effortful, but not so hard they become frustrating.",
    "tags": ["cognitive-science", "learning-theory"]
  }
]

**Conversation to Process:**

Based on this learning conversation about "${chat.topic}", generate flashcards that help reinforce key concepts.

Conversation Context:
- Title: ${chat.title}
- Topic: ${chat.topic}
- Duration: ${durationMinutes} minutes
- Messages: ${messages.length}

Conversation:
${conversation}`

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: prompt }] }
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.3, // Lower temperature for more consistent JSON output
            maxOutputTokens: 8192,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH", 
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      throw new Error(`Gemini API error: ${geminiResponse.status}`)
    }

    const geminiData = await geminiResponse.json()
    
    if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content) {
      throw new Error('Invalid response from Gemini API')
    }

    const aiResponse = geminiData.candidates[0].content.parts[0].text
    
    // Parse JSON response
    try {
      const parsedJson = JSON.parse(aiResponse)
      let flashcards: GeneratedFlashcard[];

      if (Array.isArray(parsedJson)) {
        flashcards = parsedJson;
      } else if (parsedJson.flashcards && Array.isArray(parsedJson.flashcards)) {
        flashcards = parsedJson.flashcards;
      } else {
        console.error('Invalid flashcard response format. Expected an array of flashcards or an object with a "flashcards" key.', aiResponse)
        return []
      }
      
      // Validate and filter flashcards
      const validFlashcards = flashcards.filter(flashcard => {
        return flashcard.type && 
               flashcard.front && 
               flashcard.back && 
               ['qa', 'definition', 'cloze'].includes(flashcard.type.toLowerCase()) &&
               flashcard.front.trim().length > 0 &&
               flashcard.back.trim().length > 0
      })

      return validFlashcards

    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError)
      console.error('AI Response:', aiResponse)
      return []
    }

  } catch (error) {
    console.error('Error calling Gemini API:', error)
    return []
  }
}
