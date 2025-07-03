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
    // For new cards, create an empty card without passing due date
    // Let FSRS determine the initial scheduling
    return createEmptyCard();
  }

  // Map state strings to numbers with explicit validation
  let stateNum: number;
  switch (flashcard.state) {
    case 'LEARNING': 
      stateNum = 1; 
      break;
    case 'REVIEW': 
      stateNum = 2; 
      break;
    case 'RELEARNING': 
      stateNum = 3; 
      break;
    default: 
      console.warn(`Unknown flashcard state: ${flashcard.state}, treating as NEW`);
      return createEmptyCard();
  }

  // Validate required fields for existing cards
  if (!flashcard.due) {
    console.warn('Card missing due date, treating as NEW');
    return createEmptyCard();
  }

  // For existing cards, reconstruct the Card object
  return {
    due: new Date(flashcard.due),
    stability: flashcard.stability || 0.4,
    difficulty: flashcard.difficulty || 5.0,
    elapsed_days: flashcard.elapsed_days || 0,
    scheduled_days: flashcard.scheduled_days || 0,
    reps: flashcard.reps || 0,
    lapses: flashcard.lapses || 0,
    state: stateNum,
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

    // Initialize FSRS with optimized parameters
    const params = generatorParameters({ 
      enable_fuzz: true,
      enable_short_term: true, // Enable short-term memory optimization
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

    // Validate card state before processing
    if (currentCard.due > reviewTime && currentCard.state !== 0) {
      console.warn('Card is not yet due for review', {
        id: flashcard_id,
        due: currentCard.due.toISOString(),
        now: reviewTime.toISOString(),
        state: currentCard.state,
        daysDifference: Math.round((currentCard.due.getTime() - reviewTime.getTime()) / (1000 * 60 * 60 * 24))
      });
    }

    console.log('Processing review for flashcard:', {
      id: flashcard_id,
      currentState: flashcard.state,
      currentDue: flashcard.due,
      rating: rating,
      isOverdue: currentCard.due < reviewTime
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
    
    // Validate scheduling cards were generated
    if (!schedulingCards || typeof schedulingCards !== 'object') {
      throw new Error('Failed to generate scheduling options from FSRS');
    }
    
    console.log('Scheduling cards debug:', {
      schedulingCardsLength: Object.keys(schedulingCards).length,
      schedulingCardsKeys: Object.keys(schedulingCards),
      hasAgain: schedulingCards[Rating.Again] !== undefined,
      hasHard: schedulingCards[Rating.Hard] !== undefined,
      hasGood: schedulingCards[Rating.Good] !== undefined,
      hasEasy: schedulingCards[Rating.Easy] !== undefined,
    });
    
    // Convert our 1-4 rating to ts-fsrs Rating enum values
    let tsfsrsRating: Rating;
    switch (rating) {
      case 1: tsfsrsRating = Rating.Again; break;
      case 2: tsfsrsRating = Rating.Hard; break;
      case 3: tsfsrsRating = Rating.Good; break;
      case 4: tsfsrsRating = Rating.Easy; break;
      default: throw new Error(`Invalid rating: ${rating}. Must be 1 (Again), 2 (Hard), 3 (Good), or 4 (Easy).`);
    }
    
    const selectedSchedule = schedulingCards[tsfsrsRating];
    
    if (!selectedSchedule) {
      console.error('Rating selection failed:', {
        rating,
        tsfsrsRating,
        schedulingCardsKeys: Object.keys(schedulingCards),
        ratingExists: tsfsrsRating in schedulingCards,
        schedulingCardsData: Object.fromEntries(
          Object.entries(schedulingCards).map(([key, value]) => [
            key, 
            value ? { hasCard: !!value.card, hasLog: !!value.log } : null
          ])
        )
      });
      throw new Error(`Invalid rating selection: ${rating} (tsfsrs: ${tsfsrsRating}). Available options: ${Object.keys(schedulingCards).join(', ')}. This may indicate an FSRS library issue.`);
    }

    const { card: updatedCard, log } = selectedSchedule;

    // Validate the FSRS results
    if (!updatedCard || !log) {
      throw new Error('FSRS returned invalid card or log data');
    }

    // Validate the updated card has required fields
    if (!updatedCard.due || updatedCard.stability === undefined || updatedCard.difficulty === undefined) {
      throw new Error('FSRS returned incomplete card data');
    }

    console.log('FSRS calculation result:', {
      beforeState: stateToString(log.state),
      afterState: stateToString(updatedCard.state),
      scheduledDays: updatedCard.scheduled_days,
      nextDue: updatedCard.due.toISOString(),
      stabilityChange: `${log.stability} → ${updatedCard.stability}`,
      difficultyChange: `${log.difficulty} → ${updatedCard.difficulty}`,
      repsIncrement: `${log.reps || 0} → ${updatedCard.reps}`
    });

    // Validate the new due date is reasonable
    const daysDiff = Math.round((updatedCard.due.getTime() - reviewTime.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 0) {
      console.warn('FSRS scheduled card in the past', {
        due: updatedCard.due.toISOString(),
        now: reviewTime.toISOString(),
        daysDiff
      });
    }

    // Update flashcard with new FSRS data
    const updateData = {
      state: stateToString(updatedCard.state),
      due: updatedCard.due.toISOString(),
      stability: updatedCard.stability,
      difficulty: updatedCard.difficulty,
      elapsed_days: updatedCard.elapsed_days,
      scheduled_days: updatedCard.scheduled_days,
      reps: updatedCard.reps,
      lapses: updatedCard.lapses,
      last_review: updatedCard.last_review?.toISOString() || reviewTime.toISOString(),
      learning_steps: updatedCard.learning_steps || 0,
      updated_at: reviewTime.toISOString()
    };

    const { error: updateError } = await supabaseClient
      .from('flashcards')
      .update(updateData)
      .eq('id', flashcard_id)

    if (updateError) {
      console.error('Error updating flashcard:', updateError)
      throw new Error(`Failed to update flashcard: ${updateError.message}`)
    }

    // Log the review with comprehensive data
    const reviewLogData = {
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
    };

    const { error: reviewLogError } = await supabaseClient
      .from('flashcard_reviews')
      .insert(reviewLogData);

    if (reviewLogError) {
      console.error('Failed to log review:', reviewLogError);
      // Don't fail the request if logging fails, but log the error
      // This ensures the main review operation succeeds even if logging has issues
    }

    // Return comprehensive response data
    const responseData = {
      success: true,
      next_review: updatedCard.due.toISOString(),
      interval_days: updatedCard.scheduled_days,
      card_state: stateToString(updatedCard.state),
      stability: updatedCard.stability,
      difficulty: updatedCard.difficulty,
      reps: updatedCard.reps,
      lapses: updatedCard.lapses,
      // Additional useful data for client
      state_changed: log.state !== updatedCard.state,
      days_until_due: daysDiff
    };

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Review processing error:', {
      error: error.message,
      stack: error.stack,
      flashcard_id: reviewRequest?.flashcard_id,
      rating: reviewRequest?.rating,
      user_id: user?.id
    });
    
    // Provide more specific error messages based on error type
    let errorMessage = 'An error occurred while processing the review';
    let statusCode = 400;
    
    if (error.message.includes('Flashcard not found')) {
      errorMessage = 'Flashcard not found or access denied';
      statusCode = 404;
    } else if (error.message.includes('Invalid rating')) {
      errorMessage = error.message;
      statusCode = 400;
    } else if (error.message.includes('FSRS')) {
      errorMessage = 'Error in spaced repetition calculation: ' + error.message;
      statusCode = 500;
    } else if (error.message.includes('Database')) {
      errorMessage = 'Database error occurred';
      statusCode = 500;
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 