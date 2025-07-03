import { useAuth } from '@/context/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  StyleSheet,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import {
  LongPressGestureHandler,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State
} from 'react-native-gesture-handler';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Flashcard {
  id: string;
  type: 'qa' | 'definition' | 'cloze';
  front: string;
  back: string;
  tags: string[];
  // FSRS properties
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

interface FlashcardStats {
  due_today: number;
  due_overdue: number;
  new_cards: number;
  total_reviews_today: number;
}

const CARD_WIDTH = screenWidth * 0.9;
const CARD_HEIGHT = screenHeight * 0.6;

export default function FlashcardDeck() {
  const { user } = useAuth();
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [stats, setStats] = useState<FlashcardStats | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [previewRating, setPreviewRating] = useState<number | null>(null);
  const [hasSeenAnswer, setHasSeenAnswer] = useState(false);
  
  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');
  const cardFrontColor = useThemeColor({ light: '#ffffff', dark: '#1f2937' }, 'background');
  const cardBackColor = useThemeColor({ light: '#f8f9fa', dark: '#374151' }, 'background');
  const shadowColor = useThemeColor({ light: '#000000', dark: '#000000' }, 'text');
  
  // Animation values
  const flipValue = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const deleteOpacity = useRef(new Animated.Value(0)).current;
  const ratingOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (user) {
      fetchFlashcards();
    }
  }, [user]);

  useEffect(() => {
    // Load more cards when approaching the end
    if (flashcards.length > 0 && currentIndex >= flashcards.length - 3) {
      fetchMoreFlashcards();
    }
  }, [currentIndex, flashcards.length]);

  const deleteFlashcard = async (flashcardId: string) => {
    if (!user) return;

    try {
      setIsDeleting(true);
      
      const { error } = await supabase
        .from('flashcards')
        .update({ is_deleted: true })
        .eq('id', flashcardId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Remove the deleted flashcard from the local state
      setFlashcards(prev => prev.filter(card => card.id !== flashcardId));
      
      // If we deleted the current card, reset the flip state
      setIsFlipped(false);
      resetCardPosition();
      
      // If this was the last card, the currentIndex will automatically be handled
      // by the component re-render since flashcards.length will be reduced
      
    } catch (error) {
      console.error('Error deleting flashcard:', error);
      Alert.alert(
        'Error',
        'Failed to delete flashcard. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLongPress = () => {
    if (isDeleting || currentIndex >= flashcards.length) return;
    
    const currentCard = flashcards[currentIndex];
    
    // Only allow deletion of real flashcards, not sample ones
    if (currentCard.id.startsWith('sample-')) {
      Alert.alert(
        'Cannot Delete',
        'This is a sample flashcard and cannot be deleted.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Delete Flashcard',
      'Are you sure you want to delete this flashcard? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteFlashcard(currentCard.id),
        },
      ]
    );
  };

  const onLongPressStateChange = (event: any) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      // Visual feedback for long press
      Animated.timing(deleteOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (event.nativeEvent.state === State.END) {
      // Hide visual feedback and trigger delete
      Animated.timing(deleteOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      handleLongPress();
    } else if (event.nativeEvent.state === State.CANCELLED || event.nativeEvent.state === State.FAILED) {
      // Hide visual feedback
      Animated.timing(deleteOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  // Sample flashcards for testing
  const sampleFlashcards: Flashcard[] = [
    {
      id: 'sample-1',
      type: 'qa',
      front: 'What is the capital of France?',
      back: 'Paris',
      tags: ['geography', 'europe'],
    },
    {
      id: 'sample-2',
      type: 'definition',
      front: 'React Native',
      back: 'A framework for building mobile applications using React and JavaScript',
      tags: ['programming', 'mobile', 'react'],
    },
    {
      id: 'sample-3',
      type: 'cloze',
      front: 'The {{c1::mitochondria}} is known as the {{c2::powerhouse}} of the cell.',
      back: 'The mitochondria is known as the powerhouse of the cell.',
      tags: ['biology', 'cell'],
    },
    {
      id: 'sample-4',
      type: 'cloze',
      front: 'In {{c1::React Native}}, you can use {{c2::JavaScript}} to build {{c3::mobile apps}} for both iOS and Android.',
      back: 'In React Native, you can use JavaScript to build mobile apps for both iOS and Android.',
      tags: ['programming', 'react-native', 'mobile'],
    },
  ];

  const fetchFlashcards = async () => {
    try {
      setLoading(true);
      
      // First get stats to see if there are any cards due or available
      const { data: statsData, error: statsError } = await supabase.functions
        .invoke('flashcard-due', {
          body: { stats_only: true }
        });

      if (statsError) {
        console.error('Error fetching stats:', statsError);
      } else if (statsData?.stats) {
        setStats(statsData.stats);
      }

      // Fetch due cards (including new cards)
      const { data: dueData, error: dueError } = await supabase.functions
        .invoke('flashcard-due', {
          body: {
            limit: 20,
            include_new: true,
            new_cards_limit: 5
          }
        });

      if (dueError) throw dueError;

      let flashcardData = dueData?.flashcards || [];
      
      // If no flashcards exist, use sample data for testing
      if (flashcardData.length === 0) {
        flashcardData = sampleFlashcards;
      }

      // Don't shuffle - cards are already prioritized by due date from FSRS
      setFlashcards(flashcardData);
      setCurrentIndex(0);
      setIsFlipped(false);
      resetCardPosition();
    } catch (error) {
      console.error('Error fetching flashcards:', error);
      // Fallback to sample data on error
      const randomizedCards = shuffleArray([...sampleFlashcards]);
      setFlashcards(randomizedCards);
      setCurrentIndex(0);
      setIsFlipped(false);
      resetCardPosition();
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreFlashcards = async () => {
    if (loadingMore) return;
    
    try {
      setLoadingMore(true);
      
      // For FSRS, we can fetch more cards but they might overlap with current ones
      // This is acceptable for spaced repetition as cards get scheduled for future dates
      const { data: dueData, error: dueError } = await supabase.functions
        .invoke('flashcard-due', {
          body: {
            limit: 20,
            include_new: true,
            new_cards_limit: 15
          }
        });

      if (dueError) throw dueError;

      if (dueData?.flashcards && dueData.flashcards.length > 0) {
        // Filter out cards we already have to avoid duplicates
        const existingIds = new Set(flashcards.map(card => card.id));
        const newCards = dueData.flashcards.filter((card: Flashcard) => !existingIds.has(card.id));
        
        if (newCards.length > 0) {
          setFlashcards(prev => [...prev, ...newCards]);
        }
      }
    } catch (error) {
      console.error('Error fetching more flashcards:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const shuffleArray = (array: Flashcard[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const flipCard = () => {
    Animated.timing(flipValue, {
      toValue: isFlipped ? 0 : 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
    
    // Mark that user has seen the answer when flipping to back
    if (!isFlipped) {
      setHasSeenAnswer(true);
    }
  };

  const resetCardPosition = () => {
    translateX.setValue(0);
    translateY.setValue(0);
    rotate.setValue(0);
    scale.setValue(1);
    flipValue.setValue(0);
    ratingOpacity.setValue(0);
    setIsFlipped(false);
    setPreviewRating(null);
    setSelectedRating(null);
    setHasSeenAnswer(false);
  };

  const nextCard = () => {
    // Clear rating state immediately before starting transition
    setPreviewRating(null);
    setSelectedRating(null);
    ratingOpacity.setValue(0);
    
    // Animate current card out smoothly
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: screenWidth * 1.2, // Move further off screen
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.7,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 20, // Add rotation for more dynamic exit
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Update to next card (or completion screen if this was the last card)
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
      setHasSeenAnswer(false);
      
      // Only reset and animate in new card if there's a next card
      if (currentIndex < flashcards.length - 1) {
        // Reset animation values instantly (off-screen)
        translateX.setValue(-screenWidth * 0.3); // Start from left side
        translateY.setValue(0);
        rotate.setValue(-5);
        scale.setValue(0.9);
        flipValue.setValue(0);
        ratingOpacity.setValue(0); // Ensure rating overlay is hidden
        
        // Animate new card in smoothly
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(rotate, {
            toValue: 0,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();
      }
    });
  };

  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const { translationX, translationY } = event.nativeEvent;
    
    translateX.setValue(translationX);
    translateY.setValue(translationY);
    
    // More dynamic rotation based on swipe direction and distance
    const rotateValue = translationX / 8; // Reduced for subtler rotation
    rotate.setValue(rotateValue);
    
    // Smooth scale transition with better curve
    const progress = Math.abs(translationX) / screenWidth;
    const scaleValue = 1 - (progress * 0.15); // Less aggressive scaling
    scale.setValue(Math.max(scaleValue, 0.85));
    
    // Show rating preview when user has seen answer and swiping
    if (hasSeenAnswer && !isReviewing) {
      const rating = getRatingFromSwipe(translationX, translationY);
      if (rating !== previewRating) {
        setPreviewRating(rating);
        if (rating) {
          ratingOpacity.setValue(0.8);
        } else {
          ratingOpacity.setValue(0);
        }
      }
    }
  };

  const getRatingFromSwipe = (translationX: number, translationY: number): number | null => {
    const horizontalThreshold = screenWidth * 0.25;
    const verticalThreshold = screenHeight * 0.15;
    
    // Prioritize the direction with more movement
    const absX = Math.abs(translationX);
    const absY = Math.abs(translationY);
    
    if (absX > horizontalThreshold || absY > verticalThreshold) {
      if (absX > absY) {
        // Horizontal movement is dominant
        if (translationX < 0) {
          return 1; // Left = Again
        } else {
          return 3; // Right = Good
        }
      } else {
        // Vertical movement is dominant
        if (translationY < 0) {
          return 4; // Up = Easy
        } else {
          return 2; // Down = Hard
        }
      }
    }
    
    return null; // No rating detected
  };

  const getRatingColor = (rating: number): string => {
    switch (rating) {
      case 1: return '#ef4444'; // Again - Red
      case 2: return '#f97316'; // Hard - Orange  
      case 3: return '#22c55e'; // Good - Green
      case 4: return '#3b82f6'; // Easy - Blue
      default: return tintColor;
    }
  };

  const getRatingLabel = (rating: number): string => {
    switch (rating) {
      case 1: return 'Again';
      case 2: return 'Hard';
      case 3: return 'Good'; 
      case 4: return 'Easy';
      default: return '';
    }
  };

  const onHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, translationY, velocityX } = event.nativeEvent;
      
      // Check if user has seen the answer before allowing rating
      if (!hasSeenAnswer) {
        // User hasn't seen the answer yet, show the back side instead of rating
        const threshold = screenWidth * 0.25;
        const velocityThreshold = 800;
        const shouldFlip = Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold;
        
        if (shouldFlip) {
          flipCard();
        }
        
        // Spring back to original position since we're not rating yet
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            tension: 120,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            tension: 120,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(rotate, {
            toValue: 0,
            tension: 120,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            tension: 120,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(ratingOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
        setPreviewRating(null);
        return;
      }

      // User has seen the answer, check for rating gestures
      const rating = getRatingFromSwipe(translationX, translationY);
      
      if (rating && !isReviewing) {
        // Valid rating detected, submit review
        submitReview(rating);
      } else {
        // No valid rating or still processing, spring back
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            tension: 120,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            tension: 120,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(rotate, {
            toValue: 0,
            tension: 120,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            tension: 120,
            friction: 7,
            useNativeDriver: true,
          }),
          Animated.timing(ratingOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
        setPreviewRating(null);
      }
    }
  };

  const renderFlashcardContent = (card: Flashcard, side: 'front' | 'back') => {
    const content = side === 'front' ? card.front : card.back;
    
    // Handle cloze cards specially
    if (card.type === 'cloze' && side === 'front') {
      // Find all cloze patterns like {{c1::text}}, {{c2::text}}, etc.
      const clozePattern = /\{\{c\d+::(.*?)\}\}/g;
      const clozeMatches = Array.from(content.matchAll(clozePattern));
      
      if (clozeMatches.length > 0) {
        // Split the text and create components for each part
        const parts = [];
        let lastIndex = 0;
        
        clozeMatches.forEach((match, index) => {
          const matchStart = match.index!;
          const matchEnd = matchStart + match[0].length;
          
          // Add text before the cloze
          if (matchStart > lastIndex) {
            const beforeText = content.substring(lastIndex, matchStart);
            if (beforeText) {
              parts.push(
                <ThemedText key={`before-${index}`} style={[styles.cardText, { color: textColor }]}>
                  {beforeText}
                </ThemedText>
              );
            }
          }
          
          // Add the blank
          parts.push(
            <ThemedText key={`blank-${index}`} style={[styles.clozeBlank, { color: tintColor }]}>
              _____
            </ThemedText>
          );
          
          lastIndex = matchEnd;
        });
        
        // Add any remaining text after the last cloze
        if (lastIndex < content.length) {
          const afterText = content.substring(lastIndex);
          if (afterText) {
            parts.push(
              <ThemedText key="after" style={[styles.cardText, { color: textColor }]}>
                {afterText}
              </ThemedText>
            );
          }
        }
        
        return (
          <View style={styles.cardContent}>
            <ThemedText style={[styles.cardTypeText, { color: textColor, opacity: 0.5 }]}>
              {card.type.toUpperCase()}
            </ThemedText>
            <View style={styles.clozeContainer}>
              <View style={styles.clozeTextContainer}>
                {parts}
              </View>
            </View>
          </View>
        );
      }
    }
    
    // For cloze back side or if no cloze patterns found, show the clean text
    if (card.type === 'cloze' && side === 'back') {
      // Remove all cloze markup from the back side
      const cleanContent = content.replace(/\{\{c\d+::(.*?)\}\}/g, '$1');
      
      return (
        <View style={styles.cardContent}>
          <ThemedText style={[styles.cardTypeText, { color: textColor, opacity: 0.5 }]}>
            {card.type.toUpperCase()}
          </ThemedText>
          <ThemedText style={[styles.answerLabel, { color: tintColor }]}>
            ANSWER
          </ThemedText>
          <ThemedText style={[styles.cardText, { color: textColor }]}>{cleanContent}</ThemedText>
        </View>
      );
    }
    
    // Handle back side for all other card types
    if (side === 'back') {
      return (
        <View style={styles.cardContent}>
          <ThemedText style={[styles.cardTypeText, { color: textColor, opacity: 0.5 }]}>
            {card.type.toUpperCase()}
          </ThemedText>
          <ThemedText style={[styles.answerLabel, { color: tintColor }]}>
            ANSWER
          </ThemedText>
          <ThemedText style={[styles.cardText, { color: textColor }]}>{content}</ThemedText>
        </View>
      );
    }
    
    // Front side (default case)
    return (
      <View style={styles.cardContent}>
        <ThemedText style={[styles.cardTypeText, { color: textColor, opacity: 0.5 }]}>
          {card.type.toUpperCase()}
        </ThemedText>
        <ThemedText style={[styles.cardText, { color: textColor }]}>{content}</ThemedText>
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={tintColor} />
        <ThemedText style={styles.loadingText}>Loading flashcards...</ThemedText>
      </ThemedView>
    );
  }

  const submitReview = async (rating: number) => {
    if (!user || currentIndex >= flashcards.length || isReviewing) return;
    
    const currentCard = flashcards[currentIndex];
    
    // Skip review for sample cards
    if (currentCard.id.startsWith('sample-')) {
      nextCard();
      return;
    }
    
    try {
      setIsReviewing(true);
      setSelectedRating(rating);
      
      // Show rating feedback briefly, then advance immediately (optimistic update)
      setTimeout(() => {
        nextCard();
      }, 100); // Reduced delay for faster feedback
      
      // Make the API call in the background (non-blocking)
      const reviewStartTime = Date.now();
      
      // Don't await this - let it happen in background
      supabase.functions
        .invoke('flashcard-review', {
          body: {
            flashcard_id: currentCard.id,
            rating: rating, // 1=Again, 2=Hard, 3=Good, 4=Easy
            review_duration_ms: Date.now() - reviewStartTime
          }
        })
        .then(({ data: reviewData, error: reviewError }) => {
          if (reviewError) {
            console.error('Background review submission failed:', reviewError);
            Alert.alert(
              'Review Failed',
              'Failed to save your review. Your progress may not be saved.',
              [{ text: 'OK' }]
            );
            return;
          }
          
          console.log('Review submitted:', {
            rating,
            next_review: reviewData?.next_review_date,
            interval_days: reviewData?.interval_days
          });
        })
        .catch((error) => {
          console.error('Background review submission error:', error);
          Alert.alert(
            'Network Error',
            'Unable to save your review due to network issues. Please check your connection.',
            [{ text: 'OK' }]
          );
        });
        
    } catch (error) {
      console.error('Error in submitReview:', error);
      // Even if there's an immediate error, still advance to prevent getting stuck
      nextCard();
    } finally {
      setIsReviewing(false);
    }
  };

  const restartDeck = () => {
    // Refetch cards to get fresh due cards with FSRS prioritization
    fetchFlashcards();
  };

  if (currentIndex >= flashcards.length) {
    return (
      <ThemedView style={styles.completedContainer}>
        <ThemedText style={styles.completedTitle}>🎉 Well Done!</ThemedText>
        <ThemedText style={styles.completedText}>
          You&apos;ve reviewed all available flashcards. Great job!
        </ThemedText>
        <TouchableWithoutFeedback onPress={restartDeck}>
          <View style={[styles.restartButton, { backgroundColor: tintColor }]}>
            <ThemedText style={[styles.restartButtonText, { color: backgroundColor }]}>🔄 Start Over</ThemedText>
          </View>
        </TouchableWithoutFeedback>
      </ThemedView>
    );
  }

  const currentCard = flashcards[currentIndex];
  
  // Create interpolated styles for the flip animation
  const frontAnimatedStyle = {
    transform: [
      {
        rotateY: flipValue.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        }),
      },
    ],
  };

  const backAnimatedStyle = {
    transform: [
      {
        rotateY: flipValue.interpolate({
          inputRange: [0, 1],
          outputRange: ['180deg', '360deg'],
        }),
      },
    ],
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ThemedText style={[styles.counterText, { color: textColor, opacity: 0.7 }]}>
            {currentIndex + 1} of {flashcards.length}
          </ThemedText>
          {stats && (
            <ThemedText style={[styles.statsText, { color: textColor, opacity: 0.5 }]}>
              Due: {stats.due_today + stats.due_overdue} • New: {stats.new_cards}
            </ThemedText>
          )}
        </View>
        {loadingMore && (
          <ActivityIndicator size="small" color={tintColor} />
        )}
      </View>

      <View style={styles.cardContainer}>
        {/* Next card preview (behind current card) */}
        {currentIndex < flashcards.length - 1 && (
          <Animated.View style={[styles.card, styles.nextCardPreview]}>
            <Animated.View
              style={[
                styles.cardFace,
                { 
                  backgroundColor: cardFrontColor,
                  shadowColor: shadowColor,
                  opacity: 0.2,
                  transform: [
                    { scale: 0.95 }, 
                    { translateY: 10 },
                    { 
                      translateX: translateX.interpolate({
                        inputRange: [-screenWidth, 0, screenWidth],
                        outputRange: [5, 0, -5],
                        extrapolate: 'clamp',
                      })
                    },
                  ],
                },
              ]}
            >
              {renderFlashcardContent(flashcards[currentIndex + 1], 'front')}
            </Animated.View>
          </Animated.View>
        )}

        {/* Current card */}
        <LongPressGestureHandler
          onHandlerStateChange={onLongPressStateChange}
          minDurationMs={800}
        >
          <PanGestureHandler
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
          >
            <Animated.View
              style={[
                styles.card,
                styles.currentCard,
                {
                  transform: [
                    { translateX },
                    { translateY },
                    { rotate: rotate.interpolate({
                      inputRange: [-1, 1],
                      outputRange: ['-1deg', '1deg'],
                    }) },
                    { scale },
                  ],
                },
              ]}
            >
              <TouchableWithoutFeedback onPress={flipCard}>
                <View style={styles.cardInteractionArea}>
                  {/* Delete overlay */}
                  <Animated.View
                    style={[
                      styles.deleteOverlay,
                      {
                        opacity: deleteOpacity,
                      },
                    ]}
                  >
                    <ThemedText style={styles.deleteText}>🗑️ Release to Delete</ThemedText>
                  </Animated.View>

                  {/* Rating overlay */}
                  {(previewRating || selectedRating) && (
                    <Animated.View
                      style={[
                        styles.ratingOverlay,
                        {
                          opacity: selectedRating ? 1 : ratingOpacity,
                          backgroundColor: getRatingColor(previewRating || selectedRating || 3),
                        },
                      ]}
                    >
                      <ThemedText style={styles.ratingText}>
                        {getRatingLabel(previewRating || selectedRating || 3)}
                      </ThemedText>
                      {selectedRating && (
                        <ThemedText style={styles.ratingSubtext}>
                          Review submitted!
                        </ThemedText>
                      )}
                    </Animated.View>
                  )}

                  {/* Front of card */}
                  <Animated.View
                    style={[
                      styles.cardFace,
                      { 
                        backgroundColor: cardFrontColor,
                        shadowColor: shadowColor,
                      },
                      frontAnimatedStyle,
                    ]}
                  >
                    {renderFlashcardContent(currentCard, 'front')}
                  </Animated.View>

                  {/* Back of card */}
                  <Animated.View
                    style={[
                      styles.cardFace,
                      styles.cardBack,
                      { 
                        backgroundColor: cardBackColor,
                        shadowColor: shadowColor,
                      },
                      backAnimatedStyle,
                    ]}
                  >
                    {renderFlashcardContent(currentCard, 'back')}
                  </Animated.View>
                </View>
              </TouchableWithoutFeedback>
            </Animated.View>
          </PanGestureHandler>
        </LongPressGestureHandler>
      </View>

      <View style={styles.instructions}>
        <ThemedText style={[styles.instructionText, { color: textColor, opacity: 0.6 }]}>
          Tap to flip • Then swipe: ← Again • ↓ Hard • → Good • ↑ Easy
        </ThemedText>
        <ThemedText style={[styles.instructionSubtext, { color: textColor, opacity: 0.4 }]}>
          Long press to delete
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    opacity: 0.7,
  },
  completedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  completedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  completedText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: CARD_WIDTH,
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  counterText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    position: 'relative',
  },
  cardInteractionArea: {
    width: '100%',
    height: '100%',
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    borderRadius: 20,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  cardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTypeText: {
    position: 'absolute',
    top: 16,
    right: 16,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  cardText: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    fontWeight: '500',
  },
  clozeContainer: {
    alignItems: 'center',
  },
  clozeBlank: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },

  instructions: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  instructionSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  clozeTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  nextCardPreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  currentCard: {
    zIndex: 2,
  },
  deleteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    zIndex: 10,
  },
  deleteText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  ratingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    zIndex: 11,
  },
  ratingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ratingSubtext: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.9,
  },
  restartButton: {
    marginTop: 32,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  restartButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});