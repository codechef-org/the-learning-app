/**
 * FlashcardDeck Component - FSRS Spaced Repetition System
 * 
 * Features:
 * - NEW CARDS: Shows both front and back simultaneously for learning
 * - REVIEW CARDS: Traditional flip behavior for testing recall
 * - FSRS Algorithm: Scientific spaced repetition scheduling
 * - Swipe Gestures: Rate cards with directional swipes (mobile)
 * - Button Controls: Rate cards with buttons (web)
 * - Keyboard Shortcuts: Rate cards with keys 1-4 (web)
 * - Animations: Smooth card transitions and feedback
 */

import { useAuth } from '@/context/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { supabase } from '@/lib/supabase';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
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

// Web-responsive sizing
const isWeb = Platform.OS === 'web';
const CARD_WIDTH = isWeb ? Math.min(screenWidth * 0.7, 600) : screenWidth * 0.9;
const CARD_HEIGHT = isWeb ? Math.min(screenHeight * 0.7, 500) : screenHeight * 0.6;

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
  next_due_date?: string;
}

// Animation constants for consistency
const ANIMATION_CONFIG = {
  SPRING_DEFAULT: {
    tension: 120,
    friction: 7,
    useNativeDriver: true,
  },
  SPRING_FAST: {
    tension: 150,
    friction: 8,
    useNativeDriver: true,
  },
  TIMING_FAST: {
    duration: 200,
    useNativeDriver: true,
  },
  TIMING_MEDIUM: {
    duration: 400,
    useNativeDriver: true,
  },
  TIMING_SLOW: {
    duration: 600,
    useNativeDriver: true,
  },
} as const;

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

  // Helper function to identify new cards
  const isNewCard = useCallback((card: Flashcard): boolean => {
    return !card.state || card.state === 'NEW';
  }, []);
  
  // Animation values
  const flipValue = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const deleteOpacity = useRef(new Animated.Value(0)).current;
  const ratingOpacity = useRef(new Animated.Value(0)).current;

  // Animation cleanup
  const animationRefs = useRef<Animated.CompositeAnimation[]>([]);
  
  const stopAllAnimations = useCallback(() => {
    animationRefs.current.forEach(animation => animation.stop());
    animationRefs.current = [];
  }, []);

  const addAnimation = useCallback((animation: Animated.CompositeAnimation) => {
    animationRefs.current.push(animation);
    return animation;
  }, []);

  // Optimized animation functions
  const createSpringToPosition = useCallback((
    values: { x?: number; y?: number; scale?: number; rotate?: number },
    config: typeof ANIMATION_CONFIG.SPRING_DEFAULT | typeof ANIMATION_CONFIG.SPRING_FAST = ANIMATION_CONFIG.SPRING_DEFAULT
  ) => {
    const animations = [];
    
    if (values.x !== undefined) {
      animations.push(Animated.spring(translateX, { toValue: values.x, ...config }));
    }
    if (values.y !== undefined) {
      animations.push(Animated.spring(translateY, { toValue: values.y, ...config }));
    }
    if (values.scale !== undefined) {
      animations.push(Animated.spring(scale, { toValue: values.scale, ...config }));
    }
    if (values.rotate !== undefined) {
      animations.push(Animated.spring(rotate, { toValue: values.rotate, ...config }));
    }
    
    return Animated.parallel(animations);
  }, [translateX, translateY, scale, rotate]);

  const createTimingAnimation = useCallback((
    values: { opacity?: number; duration?: number },
    config = ANIMATION_CONFIG.TIMING_FAST
  ) => {
    const animations = [];
    
    if (values.opacity !== undefined) {
      animations.push(Animated.timing(ratingOpacity, { 
        toValue: values.opacity, 
        duration: values.duration || config.duration,
        useNativeDriver: true
      }));
    }
    
    return animations.length === 1 ? animations[0] : Animated.parallel(animations);
  }, [ratingOpacity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllAnimations();
    };
  }, [stopAllAnimations]);



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

  // Handle hasSeenAnswer state when the current card changes
  useEffect(() => {
    if (flashcards.length > 0 && currentIndex < flashcards.length) {
      const currentCard = flashcards[currentIndex];
      // For new cards, user can see the answer immediately
      setHasSeenAnswer(isNewCard(currentCard));
    }
  }, [currentIndex, flashcards, isNewCard]);

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

  const onLongPressStateChange = useCallback((event: any) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      // Visual feedback for long press
      const showDeleteAnimation = Animated.timing(deleteOpacity, {
        toValue: 1,
        ...ANIMATION_CONFIG.TIMING_FAST,
      });
      addAnimation(showDeleteAnimation).start();
    } else if (event.nativeEvent.state === State.END) {
      // Hide visual feedback and trigger delete
      const hideDeleteAnimation = Animated.timing(deleteOpacity, {
        toValue: 0,
        ...ANIMATION_CONFIG.TIMING_FAST,
      });
      addAnimation(hideDeleteAnimation).start();
      handleLongPress();
    } else if (event.nativeEvent.state === State.CANCELLED || event.nativeEvent.state === State.FAILED) {
      // Hide visual feedback
      const hideDeleteAnimation = Animated.timing(deleteOpacity, {
        toValue: 0,
        ...ANIMATION_CONFIG.TIMING_FAST,
      });
      addAnimation(hideDeleteAnimation).start();
    }
  }, [deleteOpacity, addAnimation, handleLongPress]);



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
      
      // If no flashcards are due, fetch the next upcoming due date
      if (flashcardData.length === 0 && user) {
        const { data: nextCardData, error: nextCardError } = await supabase
          .from('flashcards')
          .select('due')
          .eq('user_id', user.id)
          .eq('is_deleted', false)
          .not('state', 'eq', 'NEW')
          .gt('due', new Date().toISOString())
          .order('due', { ascending: true })
          .limit(1)
          .single();

        if (!nextCardError && nextCardData?.due) {
          setStats(prev => prev ? { ...prev, next_due_date: nextCardData.due } : { 
            due_today: 0, 
            due_overdue: 0, 
            new_cards: 0, 
            total_reviews_today: 0, 
            next_due_date: nextCardData.due 
          });
        }
      }
      
      // Don't shuffle - cards are already prioritized by due date from FSRS
      setFlashcards(flashcardData);
      setCurrentIndex(0);
      setIsFlipped(false);
      resetCardPosition();
    } catch (error) {
      console.error('Error fetching flashcards:', error);
      // Set empty array on error - user will see empty state
      setFlashcards([]);
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



  const flipCard = useCallback(() => {
    // Prevent flipping for new cards since they already show both sides
    if (flashcards.length > 0 && currentIndex < flashcards.length && isNewCard(flashcards[currentIndex])) {
      return;
    }
    
    const animation = Animated.timing(flipValue, {
      toValue: isFlipped ? 0 : 1,
      ...ANIMATION_CONFIG.TIMING_SLOW,
    });
    
    addAnimation(animation).start();
    setIsFlipped(!isFlipped);
    
    // Mark that user has seen the answer when flipping to back
    if (!isFlipped) {
      setHasSeenAnswer(true);
    }
  }, [isFlipped, flipValue, addAnimation, flashcards, currentIndex, isNewCard]);

  const resetCardPosition = useCallback(() => {
    // Stop any running animations first
    stopAllAnimations();
    
    // Reset values instantly for immediate feedback
    translateX.setValue(0);
    translateY.setValue(0);
    rotate.setValue(0);
    scale.setValue(1);
    flipValue.setValue(0);
    ratingOpacity.setValue(0);
    
    // Reset state
    setIsFlipped(false);
    setPreviewRating(null);
    setSelectedRating(null);
    
    // For new cards, they can see the answer immediately, so set hasSeenAnswer to true
    if (flashcards.length > 0 && currentIndex < flashcards.length) {
      setHasSeenAnswer(isNewCard(flashcards[currentIndex]));
    } else {
      setHasSeenAnswer(false);
    }
  }, [translateX, translateY, rotate, scale, flipValue, ratingOpacity, stopAllAnimations, flashcards, currentIndex, isNewCard]);

  const nextCard = useCallback((rating?: number) => {
    // Clear rating state immediately before starting transition
    setPreviewRating(null);
    setSelectedRating(null);
    ratingOpacity.setValue(0);
    
    // Determine exit direction based on rating
    let exitTranslateX = screenWidth * 1.2; // Default: right
    let exitTranslateY = 0;
    let exitRotation = 20; // Default: slight right rotation
    
    if (rating) {
      switch (rating) {
        case 1: // Again (Left swipe)
          exitTranslateX = -screenWidth * 1.2; // Exit left
          exitRotation = -20; // Rotate left
          break;
        case 2: // Hard (Down swipe)
          exitTranslateX = screenWidth * 0.3; // Slight right drift
          exitTranslateY = screenHeight * 0.8; // Exit down
          exitRotation = 10;
          break;
        case 3: // Good (Right swipe)
          exitTranslateX = screenWidth * 1.2; // Exit right
          exitRotation = 20; // Rotate right
          break;
        case 4: // Easy (Up swipe)
          exitTranslateX = -screenWidth * 0.3; // Slight left drift
          exitTranslateY = -screenHeight * 0.8; // Exit up
          exitRotation = -10;
          break;
      }
    }
    
    // Create exit animation
    const exitAnimation = Animated.parallel([
      Animated.timing(translateX, {
        toValue: exitTranslateX,
        ...ANIMATION_CONFIG.TIMING_MEDIUM,
      }),
      Animated.timing(translateY, {
        toValue: exitTranslateY,
        ...ANIMATION_CONFIG.TIMING_MEDIUM,
      }),
      Animated.timing(scale, {
        toValue: 0.7,
        ...ANIMATION_CONFIG.TIMING_MEDIUM,
      }),
      Animated.timing(rotate, {
        toValue: exitRotation,
        ...ANIMATION_CONFIG.TIMING_MEDIUM,
      }),
    ]);
    
    addAnimation(exitAnimation).start(() => {
      // Update to next card (or completion screen if this was the last card)
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
      
      // Only reset and animate in new card if there's a next card
      if (currentIndex < flashcards.length - 1) {
        const nextCardIndex = currentIndex + 1;
        const nextCard = flashcards[nextCardIndex];
        
        // Set hasSeenAnswer based on whether the next card is new
        setHasSeenAnswer(isNewCard(nextCard));
        
        // Reset animation values instantly (off-screen)
        translateX.setValue(-screenWidth * 0.3);
        translateY.setValue(0);
        rotate.setValue(-5);
        scale.setValue(0.9);
        flipValue.setValue(0);
        ratingOpacity.setValue(0);
        
        // Create entrance animation
        const entranceAnimation = createSpringToPosition(
          { x: 0, scale: 1, rotate: 0 },
          ANIMATION_CONFIG.SPRING_FAST
        );
        
        addAnimation(entranceAnimation).start();
      } else {
        setHasSeenAnswer(false);
      }
    });
  }, [
    currentIndex,
    flashcards.length,
    ratingOpacity,
    translateX,
    translateY,
    rotate,
    scale,
    flipValue,
    addAnimation,
    createSpringToPosition
  ]);

  // Memoize rating thresholds for performance
  const ratingThresholds = useMemo(() => ({
    horizontal: screenWidth * 0.25,
    vertical: screenHeight * 0.15,
  }), []);

  // Memoize gesture thresholds
  const gestureThresholds = useMemo(() => ({
    position: screenWidth * 0.25,
    velocity: 800,
  }), []);

  // Memoized interpolated styles for the flip animation
  const frontAnimatedStyle = useMemo(() => ({
    transform: [
      {
        rotateY: flipValue.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        }),
      },
    ],
  }), [flipValue]);

  const backAnimatedStyle = useMemo(() => ({
    transform: [
      {
        rotateY: flipValue.interpolate({
          inputRange: [0, 1],
          outputRange: ['180deg', '360deg'],
        }),
      },
    ],
  }), [flipValue]);

  // Memoized next card preview transform for performance
  const nextCardTransform = useMemo(() => [
    { scale: 0.95 }, 
    { translateY: 10 },
    { 
      translateX: translateX.interpolate({
        inputRange: [-screenWidth, 0, screenWidth],
        outputRange: [5, 0, -5],
        extrapolate: 'clamp',
      })
    },
  ], [translateX]);

  // Optimized gesture event handler
  const onGestureEvent = useCallback((event: PanGestureHandlerGestureEvent) => {
    const { translationX, translationY } = event.nativeEvent;
    
    // Use native driver for smooth gesture tracking
    translateX.setValue(translationX);
    translateY.setValue(translationY);
    
    // Optimized rotation calculation
    const rotateValue = translationX * 0.125; // More efficient than division
    rotate.setValue(rotateValue);
    
    // Optimized scale calculation with clamping
    const progress = Math.abs(translationX) / screenWidth;
    const scaleValue = Math.max(1 - (progress * 0.15), 0.85);
    scale.setValue(scaleValue);
    
    // Throttled rating preview updates (only when needed)
    // For new cards, hasSeenAnswer is true, so they can show rating previews immediately
    if (hasSeenAnswer && !isReviewing) {
      const absX = Math.abs(translationX);
      const absY = Math.abs(translationY);
      
      let newRating: number | null = null;
      
      if (absX > ratingThresholds.horizontal || absY > ratingThresholds.vertical) {
        if (absX > absY) {
          newRating = translationX < 0 ? 1 : 3; // Left = Again, Right = Good
        } else {
          newRating = translationY < 0 ? 4 : 2; // Up = Easy, Down = Hard
        }
      }
      
      // Only update if rating changed to prevent unnecessary re-renders
      if (newRating !== previewRating) {
        setPreviewRating(newRating);
        ratingOpacity.setValue(newRating ? 0.8 : 0);
      }
    }
  }, [
    translateX,
    translateY,
    rotate,
    scale,
    ratingOpacity,
    hasSeenAnswer,
    isReviewing,
    previewRating,
    ratingThresholds
  ]);

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

  const onHandlerStateChange = useCallback((event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, translationY, velocityX } = event.nativeEvent;
      
      const currentCard = flashcards[currentIndex];
      const isCurrentCardNew = currentCard && isNewCard(currentCard);
      
      // Check if user has seen the answer before allowing rating
      // For new cards, hasSeenAnswer is already true, so they can rate immediately
      if (!hasSeenAnswer && !isCurrentCardNew) {
        // User hasn't seen the answer yet, show the back side instead of rating
        const shouldFlip = Math.abs(translationX) > gestureThresholds.position || 
                          Math.abs(velocityX) > gestureThresholds.velocity;
        
        if (shouldFlip) {
          flipCard();
        }
        
        // Spring back to original position using optimized function
        const springBackAnimation = Animated.parallel([
          createSpringToPosition({ x: 0, y: 0, rotate: 0, scale: 1 }, ANIMATION_CONFIG.SPRING_DEFAULT),
          createTimingAnimation({ opacity: 0 }),
        ]);
        
        addAnimation(springBackAnimation).start();
        setPreviewRating(null);
        return;
      }

      // User has seen the answer, check for rating gestures
      const rating = getRatingFromSwipe(translationX, translationY);
      
      if (rating && !isReviewing) {
        // Valid rating detected, submit review
        // Call submitReview directly to avoid dependency issues
        if (!user || currentIndex >= flashcards.length || isReviewing) return;
        
        const currentCard = flashcards[currentIndex];
        
        // Skip review for sample cards
        if (currentCard.id.startsWith('sample-')) {
          nextCard(rating);
          return;
        }
        
        setIsReviewing(true);
        setSelectedRating(rating);
        
        // Show rating feedback briefly, then advance immediately
        setTimeout(() => {
          nextCard(rating);
        }, 100);
        
        // Make the API call in the background
        const reviewStartTime = Date.now();
        
        supabase.functions
          .invoke('flashcard-review', {
            body: {
              flashcard_id: currentCard.id,
              rating: rating,
              review_duration_ms: Date.now() - reviewStartTime
            }
          })
          .catch((error) => {
            console.error('Background review submission error:', error);
          })
          .finally(() => {
            setIsReviewing(false);
          });
      } else {
        // No valid rating or still processing, spring back
        const springBackAnimation = Animated.parallel([
          createSpringToPosition({ x: 0, y: 0, rotate: 0, scale: 1 }, ANIMATION_CONFIG.SPRING_DEFAULT),
          createTimingAnimation({ opacity: 0 }),
        ]);
        
        addAnimation(springBackAnimation).start();
        setPreviewRating(null);
      }
    }
  }, [
    hasSeenAnswer,
    gestureThresholds,
    flipCard,
    createSpringToPosition,
    createTimingAnimation,
    addAnimation,
    getRatingFromSwipe,
    isReviewing,
    user,
    currentIndex,
    flashcards,
    nextCard
  ]);

  const renderNewCardLayout = (card: Flashcard) => {
    return (
      <View style={styles.newCardContainer}>
        <View style={styles.newCardSection}>
          <View style={styles.newCardHeader}>
            <ThemedText style={[styles.newCardLabel, { color: tintColor }]}>
              QUESTION
            </ThemedText>
            <View style={[styles.newCardBadge, { backgroundColor: tintColor }]}>
              <ThemedText style={[styles.newCardBadgeText, { color: backgroundColor }]}>
                NEW
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.cardTypeText, { color: textColor, opacity: 0.5 }]}>
            {card.type.toUpperCase()}
          </ThemedText>
          <View style={styles.newCardContent}>
            {renderFlashcardContent(card, 'front', true)}
          </View>
        </View>
        
        <View style={[styles.newCardDivider, { backgroundColor: textColor }]} />
        
        <View style={styles.newCardSection}>
          <ThemedText style={[styles.newCardLabel, { color: tintColor }]}>
            ANSWER
          </ThemedText>
          <View style={styles.newCardContent}>
            {renderFlashcardContent(card, 'back', true)}
          </View>
        </View>
      </View>
    );
  };

  const renderFlashcardContent = (card: Flashcard, side: 'front' | 'back', isNewCardLayout: boolean = false) => {
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
        <View style={isNewCardLayout ? undefined : styles.cardContent}>
          {!isNewCardLayout && (
            <ThemedText style={[styles.cardTypeText, { color: textColor, opacity: 0.5 }]}>
              {card.type.toUpperCase()}
            </ThemedText>
          )}
          {!isNewCardLayout && (
            <ThemedText style={[styles.answerLabel, { color: tintColor }]}>
              ANSWER
            </ThemedText>
          )}
          <ThemedText style={[styles.cardText, { color: textColor }]}>{cleanContent}</ThemedText>
        </View>
      );
    }
    
    // Handle back side for all other card types
    if (side === 'back') {
      return (
        <View style={isNewCardLayout ? undefined : styles.cardContent}>
          {!isNewCardLayout && (
            <ThemedText style={[styles.cardTypeText, { color: textColor, opacity: 0.5 }]}>
              {card.type.toUpperCase()}
            </ThemedText>
          )}
          {!isNewCardLayout && (
            <ThemedText style={[styles.answerLabel, { color: tintColor }]}>
              ANSWER
            </ThemedText>
          )}
          <ThemedText style={[styles.cardText, { color: textColor }]}>{content}</ThemedText>
        </View>
      );
    }
    
    // Front side (default case)
    return (
      <View style={isNewCardLayout ? undefined : styles.cardContent}>
        {!isNewCardLayout && (
          <ThemedText style={[styles.cardTypeText, { color: textColor, opacity: 0.5 }]}>
            {card.type.toUpperCase()}
          </ThemedText>
        )}
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

  // Empty state - no flashcards available
  if (flashcards.length === 0) {
    const formatNextDueDate = (dueDateString: string) => {
      console.log('dueDateString', dueDateString);
      const dueDate = new Date(dueDateString);
      const now = new Date();
      const diffMs = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return 'later today';
      } else if (diffDays === 1) {
        return 'tomorrow';
      } else if (diffDays <= 7) {
        return `in ${diffDays} days`;
      } else {
        return dueDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: dueDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
      }
    };

    const nextDueDateText = stats?.next_due_date ? formatNextDueDate(stats.next_due_date) : null;

    return (
      <ThemedView style={styles.emptyContainer}>
        <ThemedText style={styles.emptyIcon}>📚</ThemedText>
        <ThemedText style={styles.emptyTitle}>No flashcards are due</ThemedText>
        <ThemedText style={styles.emptyText}>
          Great! You&apos;re all caught up with your reviews.{'\n'}
          {nextDueDateText 
            ? `Your next review is ${nextDueDateText}.` 
            : 'Go learn more concepts to create new flashcards.'
          }
        </ThemedText>
        <TouchableWithoutFeedback onPress={fetchFlashcards}>
          <View style={[styles.refreshButton, { backgroundColor: tintColor }]}>
            <ThemedText style={[styles.refreshButtonText, { color: backgroundColor }]}>🔄 Refresh</ThemedText>
          </View>
        </TouchableWithoutFeedback>
      </ThemedView>
    );
  }

  const submitReview = async (rating: number) => {
    if (!user || currentIndex >= flashcards.length || isReviewing) return;
    
    const currentCard = flashcards[currentIndex];
    
    // Skip review for sample cards
    if (currentCard.id.startsWith('sample-')) {
      nextCard(rating);
      return;
    }
    
    try {
      setIsReviewing(true);
      setSelectedRating(rating);
      
      // Show rating feedback briefly, then advance immediately (optimistic update)
      setTimeout(() => {
        nextCard(rating);
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
      nextCard(rating);
    } finally {
      setIsReviewing(false);
    }
  };

  // Keyboard shortcuts for web
  useEffect(() => {
    if (!isWeb) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      if (currentIndex >= flashcards.length || isReviewing) return;

      const currentCard = flashcards[currentIndex];
      if (!currentCard) return;

      // Don't handle keys if user hasn't seen the answer for review cards
      if (!isNewCard(currentCard) && !hasSeenAnswer) {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          flipCard();
        }
        return;
      }

      switch (event.key) {
        case '1':
          event.preventDefault();
          submitReview(1); // Again
          break;
        case '2':
          event.preventDefault();
          submitReview(2); // Hard
          break;
        case '3':
          event.preventDefault();
          submitReview(3); // Good
          break;
        case '4':
          event.preventDefault();
          submitReview(4); // Easy
          break;
        case ' ':
        case 'Enter':
          event.preventDefault();
          if (!isNewCard(currentCard)) {
            flipCard();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleLongPress();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentIndex, flashcards, isReviewing, hasSeenAnswer, isNewCard, flipCard, submitReview, handleLongPress]);

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
                  transform: nextCardTransform,
                },
              ]}
            >
              {renderFlashcardContent(flashcards[currentIndex + 1], 'front')}
            </Animated.View>
          </Animated.View>
        )}

        {/* Current card */}
        {isWeb ? (
          // Web version - without gesture handlers
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

                {/* Render new card layout or traditional flip card */}
                {isNewCard(currentCard) ? (
                  // New card: show both sides simultaneously
                  <View
                    style={[
                      styles.cardFace,
                      { 
                        backgroundColor: cardFrontColor,
                        shadowColor: shadowColor,
                      },
                    ]}
                  >
                    {renderNewCardLayout(currentCard)}
                  </View>
                ) : (
                  // Review card: traditional flip behavior
                  <>
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
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        ) : (
          // Mobile version - with gesture handlers
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

                    {/* Render new card layout or traditional flip card */}
                    {isNewCard(currentCard) ? (
                      // New card: show both sides simultaneously
                      <View
                        style={[
                          styles.cardFace,
                          { 
                            backgroundColor: cardFrontColor,
                            shadowColor: shadowColor,
                          },
                        ]}
                      >
                        {renderNewCardLayout(currentCard)}
                      </View>
                    ) : (
                      // Review card: traditional flip behavior
                      <>
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
                      </>
                    )}
                  </View>
                </TouchableWithoutFeedback>
              </Animated.View>
            </PanGestureHandler>
          </LongPressGestureHandler>
        )}
      </View>

      {/* Web controls */}
      {isWeb && (
        <View style={styles.webControls}>
          {/* Show rating buttons only if user has seen the answer */}
          {(isNewCard(currentCard) || hasSeenAnswer) && (
            <View style={styles.ratingButtons}>
              <Button
                mode="contained"
                onPress={() => submitReview(1)}
                style={[styles.ratingButton, { backgroundColor: getRatingColor(1) }]}
                textColor="#ffffff"
                disabled={isReviewing}
                compact
              >
                1 - Again
              </Button>
              <Button
                mode="contained"
                onPress={() => submitReview(2)}
                style={[styles.ratingButton, { backgroundColor: getRatingColor(2) }]}
                textColor="#ffffff"
                disabled={isReviewing}
                compact
              >
                2 - Hard
              </Button>
              <Button
                mode="contained"
                onPress={() => submitReview(3)}
                style={[styles.ratingButton, { backgroundColor: getRatingColor(3) }]}
                textColor="#ffffff"
                disabled={isReviewing}
                compact
              >
                3 - Good
              </Button>
              <Button
                mode="contained"
                onPress={() => submitReview(4)}
                style={[styles.ratingButton, { backgroundColor: getRatingColor(4) }]}
                textColor="#ffffff"
                disabled={isReviewing}
                compact
              >
                4 - Easy
              </Button>
            </View>
          )}
          
          {/* Show flip button for review cards when answer not seen */}
          {!isNewCard(currentCard) && !hasSeenAnswer && (
            <View style={styles.flipButtonContainer}>
              <Button
                mode="contained"
                onPress={flipCard}
                style={[styles.flipButton, { backgroundColor: tintColor }]}
                textColor="#ffffff"
                icon="eye"
              >
                Show Answer (Space/Enter)
              </Button>
            </View>
          )}

          {/* Delete button */}
          <View style={styles.deleteButtonContainer}>
            <Button
              mode="outlined"
              onPress={handleLongPress}
              style={styles.deleteButton}
              textColor="#ef4444"
              icon="delete"
              compact
            >
              Delete (Ctrl+Del)
            </Button>
          </View>
        </View>
      )}

      <View style={styles.instructions}>
        <ThemedText style={[styles.instructionText, { color: textColor, opacity: 0.6 }]}>
          {isWeb ? (
            // Web instructions
            isNewCard(currentCard) 
              ? "New card - both sides shown • Use buttons or keys 1-4 to rate"
              : hasSeenAnswer
                ? "Use buttons or keys 1-4 to rate: 1=Again, 2=Hard, 3=Good, 4=Easy"
                : "Click 'Show Answer' or press Space/Enter to flip"
          ) : (
            // Mobile instructions
            isNewCard(currentCard) 
              ? "New card - both sides shown • Swipe: ← Again • ↓ Hard • → Good • ↑ Easy"
              : "Tap to flip • Then swipe: ← Again • ↓ Hard • → Good • ↑ Easy"
          )}
        </ThemedText>
        <ThemedText style={[styles.instructionSubtext, { color: textColor, opacity: 0.4 }]}>
          {isWeb ? "Keyboard shortcuts: 1-4 to rate, Space/Enter to flip, Ctrl+Del to delete" : "Long press to delete"}
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  refreshButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // New card layout styles
  newCardContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  newCardSection: {
    flex: 1,
    justifyContent: 'center',
    minHeight: '40%',
  },
  newCardLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  newCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newCardDivider: {
    height: 1,
    marginVertical: 16,
    opacity: 0.2,
  },
  newCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  newCardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  newCardBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  // Web-specific styles
  webControls: {
    marginTop: 20,
    alignItems: 'center',
    width: CARD_WIDTH,
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ratingButton: {
    minWidth: 100,
    borderRadius: 8,
  },
  flipButtonContainer: {
    marginBottom: 16,
  },
  flipButton: {
    borderRadius: 8,
    paddingHorizontal: 24,
  },
  deleteButtonContainer: {
    marginTop: 8,
  },
  deleteButton: {
    borderColor: '#ef4444',
    borderRadius: 8,
  },
});