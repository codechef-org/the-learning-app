import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Card, createEmptyCard, fsrs, FSRS, generatorParameters, Rating, RecordLog } from 'https://esm.sh/ts-fsrs@5.2.0';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReviewRequest {
  flashcard_id: string;
  rating: 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
  review_duration_ms?: number;
}

interface FlashcardData {
  id: string;
  user_id: string;
  type: string;
  front: string;
  back: string;
  tags: string[];
  state?: string;
  due?: string;
  stability?: number;
  difficulty?: number;
  elapsed_days?: number;
  scheduled_days?: number;
  reps?: number;
  lapses?: number;
  last_review?: string;
  learning_steps?: number;
}

// Convert database flashcard to ts-fsrs Card format
function dbToCard(flashcard: FlashcardData): Card {
  if (!flashcard.state || flashcard.state === 'NEW') {
    // For new cards, create an empty card
    return createEmptyCard(flashcard.due ? new Date(flashcard.due) : new Date());
  }

  // For existing cards, reconstruct the Card object
  return {
    due: new Date(flashcard.due || new Date()),
    stability: flashcard.stability || 0.4,
    difficulty: flashcard.difficulty || 5.0,
    elapsed_days: flashcard.elapsed_days || 0,
    scheduled_days: flashcard.scheduled_days || 0,
    reps: flashcard.reps || 0,
    lapses: flashcard.lapses || 0,
    state: flashcard.state === 'NEW' ? 0 : 
           flashcard.state === 'LEARNING' ? 1 :
           flashcard.state === 'REVIEW' ? 2 : 3, // RELEARNING
    last_review: flashcard.last_review ? new Date(flashcard.last_review) : undefined,
    learning_steps: flashcard.learning_steps || 0
  };
}

// Convert ts-fsrs state number to string
function stateToString(state: number): string {
  switch (state) {
    case 0: return 'NEW';
    case 1: return 'LEARNING';
    case 2: return 'REVIEW';
    case 3: return 'RELEARNING';
    default: return 'NEW';
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const reviewRequest: ReviewRequest = await req.json()
    const { flashcard_id, rating, review_duration_ms } = reviewRequest

    // Validate rating
    if (![1, 2, 3, 4].includes(rating)) {
      throw new Error('Invalid rating. Must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy).')
    }

    // Fetch current flashcard data
    const { data: flashcard, error: fetchError } = await supabaseClient
      .from('flashcards')
      .select('*')
      .eq('id', flashcard_id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !flashcard) {
      throw new Error('Flashcard not found or access denied')
    }

    // Initialize FSRS with default parameters
    const params = generatorParameters({ 
      enable_fuzz: true,
      enable_short_term: false,
      maximum_interval: 36500, // ~100 years
      request_retention: 0.9,
      w: [
        0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
        0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034, 0.6567
      ]
    });
    
    const f: FSRS = fsrs(params);

    // Convert database flashcard to ts-fsrs Card
    const currentCard = dbToCard(flashcard);
    const reviewTime = new Date();

    console.log('Processing review for flashcard:', {
      id: flashcard_id,
      currentState: flashcard.state,
      currentDue: flashcard.due,
      rating: rating
    });

    console.log('Current card debug:', {
      due: currentCard.due,
      stability: currentCard.stability,
      difficulty: currentCard.difficulty,
      state: currentCard.state,
      reps: currentCard.reps,
      lapses: currentCard.lapses
    });

    // Get scheduling options
    const schedulingCards: RecordLog = f.repeat(currentCard, reviewTime);
    
    console.log('Scheduling cards debug:', {
      schedulingCardsLength: schedulingCards.length,
      schedulingCardsKeys: Object.keys(schedulingCards),
      hasIndex0: schedulingCards[0] !== undefined,
      hasIndex1: schedulingCards[1] !== undefined,
      hasIndex2: schedulingCards[2] !== undefined,
      hasIndex3: schedulingCards[3] !== undefined,
    });
    
    // Convert our 1-4 rating to ts-fsrs Rating enum values
    let tsfsrsRating: Rating;
    switch (rating) {
      case 1: tsfsrsRating = Rating.Again; break;
      case 2: tsfsrsRating = Rating.Hard; break;
      case 3: tsfsrsRating = Rating.Good; break;
      case 4: tsfsrsRating = Rating.Easy; break;
      default: throw new Error(`Invalid rating: ${rating}`);
    }
    
    const selectedSchedule = schedulingCards[tsfsrsRating];
    
    if (!selectedSchedule) {
      console.error('Rating selection failed:', {
        rating,
        tsfsrsRating,
        schedulingCardsLength: schedulingCards.length,
        availableIndexes: Object.keys(schedulingCards)
      });
      throw new Error(`Invalid rating selection: ${rating} (tsfsrs: ${tsfsrsRating}). Available options: ${Object.keys(schedulingCards).join(', ')}`)
    }

    const { card: updatedCard, log } = selectedSchedule;

    console.log('FSRS calculation result:', {
      beforeState: stateToString(log.state),
      afterState: stateToString(updatedCard.state),
      scheduledDays: updatedCard.scheduled_days,
      nextDue: updatedCard.due.toISOString()
    });

    // Update flashcard with new FSRS data
    const { error: updateError } = await supabaseClient
      .from('flashcards')
      .update({
        state: stateToString(updatedCard.state),
        due: updatedCard.due.toISOString(),
        stability: updatedCard.stability,
        difficulty: updatedCard.difficulty,
        elapsed_days: updatedCard.elapsed_days,
        scheduled_days: updatedCard.scheduled_days,
        reps: updatedCard.reps,
        lapses: updatedCard.lapses,
        last_review: updatedCard.last_review?.toISOString(),
        learning_steps: updatedCard.learning_steps,
        updated_at: reviewTime.toISOString()
      })
      .eq('id', flashcard_id)

    if (updateError) {
      console.error('Error updating flashcard:', updateError)
      throw new Error(`Failed to update flashcard: ${updateError.message}`)
    }

    // Log the review
    const { error: reviewLogError } = await supabaseClient
      .from('flashcard_reviews')
      .insert({
        flashcard_id,
        user_id: user.id,
        rating,
        state_before: stateToString(log.state),
        state_after: stateToString(updatedCard.state),
        stability_before: log.stability,
        stability_after: updatedCard.stability,
        difficulty_before: log.difficulty,
        difficulty_after: updatedCard.difficulty,
        elapsed_days: log.elapsed_days,
        scheduled_days: log.scheduled_days,
        review_duration_ms,
        created_at: reviewTime.toISOString()
      })

    if (reviewLogError) {
      console.error('Failed to log review:', reviewLogError)
      // Don't fail the request if logging fails, but log the error
    }

    return new Response(
      JSON.stringify({
        success: true,
        next_review: updatedCard.due.toISOString(),
        interval_days: updatedCard.scheduled_days,
        card_state: stateToString(updatedCard.state),
        stability: updatedCard.stability,
        difficulty: updatedCard.difficulty,
        reps: updatedCard.reps,
        lapses: updatedCard.lapses
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Review processing error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 