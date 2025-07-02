import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DueFlashcardsRequest {
  limit?: number;
  include_new?: boolean;
  new_cards_limit?: number;
}

interface FlashcardStats {
  due_today: number;
  due_overdue: number;
  new_cards: number;
  total_reviews_today: number;
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

    // Handle both GET requests (with query params) and POST requests (with body params for due cards)
    let limit = 20;
    let includeNew = true;
    let newCardsLimit = 10;
    let statsOnly = false;
    let isPreviewRequest = false;
    let requestBody: any = null;

    if (req.method === 'GET') {
      // Get query parameters
      const url = new URL(req.url);
      limit = parseInt(url.searchParams.get('limit') || '20');
      includeNew = url.searchParams.get('include_new') !== 'false';
      newCardsLimit = parseInt(url.searchParams.get('new_cards_limit') || '10');
      statsOnly = url.searchParams.get('stats_only') === 'true';
    } else if (req.method === 'POST') {
      // Parse body once
      requestBody = await req.json();
      
      if (requestBody.flashcard_id) {
        // This is a preview request, handle it separately
        isPreviewRequest = true;
      } else {
        // This is a due cards request with body parameters
        limit = parseInt(requestBody.limit || '20');
        includeNew = requestBody.include_new !== false;
        newCardsLimit = parseInt(requestBody.new_cards_limit || '10');
        statsOnly = requestBody.stats_only === true;
      }
    }

    if (!isPreviewRequest) {

      const now = new Date().toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      if (statsOnly) {
        // Just return statistics
        const [dueCardsResult, newCardsResult, reviewsResult] = await Promise.all([
          // Due cards (including overdue)
          supabaseClient
            .from('flashcards')
            .select('due', { count: 'exact' })
            .eq('user_id', user.id)
            .eq('is_deleted', false)
            .not('state', 'eq', 'NEW')
            .lte('due', now),
          
          // New cards
          supabaseClient
            .from('flashcards')
            .select('id', { count: 'exact' })
            .eq('user_id', user.id)
            .eq('is_deleted', false)
            .eq('state', 'NEW'),
          
          // Today's reviews
          supabaseClient
            .from('flashcard_reviews')
            .select('id', { count: 'exact' })
            .eq('user_id', user.id)
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString())
        ]);

        // Calculate due today vs overdue
        const dueCards = dueCardsResult.data || [];
        const dueToday = dueCards.filter(card => {
          const dueDate = new Date(card.due);
          return dueDate >= todayStart && dueDate <= todayEnd;
        }).length;
        const overdue = dueCards.length - dueToday;

        const stats: FlashcardStats = {
          due_today: dueToday,
          due_overdue: overdue,
          new_cards: newCardsResult.count || 0,
          total_reviews_today: reviewsResult.count || 0
        };

        return new Response(
          JSON.stringify({ stats }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch due cards (including overdue)
      const { data: dueCards, error: dueError } = await supabaseClient
        .from('flashcards')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .not('state', 'eq', 'NEW')
        .lte('due', now)
        .order('due', { ascending: true })
        .limit(limit);

      if (dueError) {
        throw new Error(`Failed to fetch due cards: ${dueError.message}`);
      }

      let allCards = dueCards || [];

      // Add new cards if requested and we have room
      if (includeNew && allCards.length < limit) {
        const remainingSlots = Math.min(newCardsLimit, limit - allCards.length);
        
        const { data: newCards, error: newError } = await supabaseClient
          .from('flashcards')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .eq('state', 'NEW')
          .order('created_at', { ascending: false })
          .limit(remainingSlots);

        if (newError) {
          console.error('Error fetching new cards:', newError);
        } else if (newCards) {
          allCards = [...allCards, ...newCards];
        }
      }

      console.log(`Fetched ${allCards.length} flashcards for user ${user.id}: ${(dueCards || []).length} due cards, ${allCards.length - (dueCards || []).length} new cards`);

              return new Response(
          JSON.stringify({
            flashcards: allCards,
            total_due: (dueCards || []).length,
            total_new: allCards.length - (dueCards || []).length,
            has_more: allCards.length === limit
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

    // Handle preview intervals for a specific card (POST request with flashcard_id)
    if (isPreviewRequest) {
      const { fsrs, generatorParameters, createEmptyCard, Card } = await import('https://esm.sh/ts-fsrs@5.2.0');
      
      const { flashcard_id } = requestBody;

      if (!flashcard_id) {
        throw new Error('flashcard_id is required');
      }

      // Fetch the flashcard
      const { data: flashcard, error: fetchError } = await supabaseClient
        .from('flashcards')
        .select('*')
        .eq('id', flashcard_id)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !flashcard) {
        throw new Error('Flashcard not found');
      }

      // Convert to ts-fsrs Card format
      let currentCard: Card;
      if (!flashcard.state || flashcard.state === 'NEW') {
        currentCard = createEmptyCard(flashcard.due ? new Date(flashcard.due) : new Date());
      } else {
        currentCard = {
          due: new Date(flashcard.due || new Date()),
          stability: flashcard.stability || 0.4,
          difficulty: flashcard.difficulty || 5.0,
          elapsed_days: flashcard.elapsed_days || 0,
          scheduled_days: flashcard.scheduled_days || 0,
          reps: flashcard.reps || 0,
          lapses: flashcard.lapses || 0,
          state: flashcard.state === 'NEW' ? 0 : 
                 flashcard.state === 'LEARNING' ? 1 :
                 flashcard.state === 'REVIEW' ? 2 : 3,
          last_review: flashcard.last_review ? new Date(flashcard.last_review) : undefined,
          learning_steps: flashcard.learning_steps || 0
        };
      }

      // Initialize FSRS
      const params = generatorParameters({ 
        enable_fuzz: true,
        enable_short_term: false,
        maximum_interval: 36500,
        request_retention: 0.9
      });
      const f = fsrs(params);

      // Get preview intervals for all ratings
      const schedulingCards = f.repeat(currentCard, new Date());
      
      const previews = {
        again: {
          interval_days: schedulingCards[0].card.scheduled_days,
          due: schedulingCards[0].card.due.toISOString()
        },
        hard: {
          interval_days: schedulingCards[1].card.scheduled_days,
          due: schedulingCards[1].card.due.toISOString()
        },
        good: {
          interval_days: schedulingCards[2].card.scheduled_days,
          due: schedulingCards[2].card.due.toISOString()
        },
        easy: {
          interval_days: schedulingCards[3].card.scheduled_days,
          due: schedulingCards[3].card.due.toISOString()
        }
      };

      return new Response(
        JSON.stringify({ previews }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('Flashcard due fetch error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}) 