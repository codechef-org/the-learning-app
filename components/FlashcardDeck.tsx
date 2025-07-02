import { useAuth } from '@/context/AuthContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import { supabase } from '@/lib/supabase';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    StyleSheet,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import {
    PanGestureHandler,
    PanGestureHandlerGestureEvent,
    State,
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
      const { data, error } = await supabase
        .from('flashcards')
        .select('id, type, front, back, tags')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      let flashcardData = data || [];
      
      // If no flashcards exist, use sample data for testing
      if (flashcardData.length === 0) {
        flashcardData = sampleFlashcards;
      }

      const randomizedCards = shuffleArray([...flashcardData]);
      setFlashcards(randomizedCards);
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
      const { data, error } = await supabase
        .from('flashcards')
        .select('id, type, front, back, tags')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(flashcards.length, flashcards.length + 19);

      if (error) throw error;

      if (data && data.length > 0) {
        const randomizedNewCards = shuffleArray([...data]);
        setFlashcards(prev => [...prev, ...randomizedNewCards]);
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
  };

  const resetCardPosition = () => {
    translateX.setValue(0);
    translateY.setValue(0);
    rotate.setValue(0);
    scale.setValue(1);
    flipValue.setValue(0);
    setIsFlipped(false);
  };

  const nextCard = () => {
    if (currentIndex < flashcards.length - 1) {
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
        // Update to next card
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
        
        // Reset animation values instantly (off-screen)
        translateX.setValue(-screenWidth * 0.3); // Start from left side
        translateY.setValue(0);
        rotate.setValue(-5);
        scale.setValue(0.9);
        flipValue.setValue(0);
        
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
      });
    }
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
  };

  const onHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent;
      
      const threshold = screenWidth * 0.25; // Lower threshold for easier swiping
      const velocityThreshold = 800;
      const shouldSwipe = Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold;
      
      if (shouldSwipe) {
        nextCard();
      } else {
        // Improved spring back animation
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
        ]).start();
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
            {card.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {card.tags.map((tag, index) => (
                  <View key={index} style={[styles.tag, { backgroundColor: tintColor }]}>
                    <ThemedText style={styles.tagText}>{tag}</ThemedText>
                  </View>
                ))}
              </View>
            )}
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
          <ThemedText style={[styles.cardText, { color: textColor }]}>{cleanContent}</ThemedText>
          {card.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {card.tags.map((tag, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: tintColor }]}>
                  <ThemedText style={styles.tagText}>{tag}</ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    }
    
    return (
      <View style={styles.cardContent}>
        <ThemedText style={[styles.cardTypeText, { color: textColor, opacity: 0.5 }]}>
          {card.type.toUpperCase()}
        </ThemedText>
        <ThemedText style={[styles.cardText, { color: textColor }]}>{content}</ThemedText>
        {card.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {card.tags.map((tag, index) => (
              <View key={index} style={[styles.tag, { backgroundColor: tintColor }]}>
                <ThemedText style={styles.tagText}>{tag}</ThemedText>
              </View>
            ))}
          </View>
        )}
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

  if (currentIndex >= flashcards.length) {
    return (
      <ThemedView style={styles.completedContainer}>
        <ThemedText style={styles.completedTitle}>🎉 Well Done!</ThemedText>
        <ThemedText style={styles.completedText}>
          You&apos;ve reviewed all available flashcards. Great job!
        </ThemedText>
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
        <ThemedText style={[styles.counterText, { color: textColor, opacity: 0.7 }]}>
          {currentIndex + 1} of {flashcards.length}
        </ThemedText>
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
      </View>

      <View style={styles.instructions}>
        <ThemedText style={[styles.instructionText, { color: textColor, opacity: 0.6 }]}>
          Tap to flip • Swipe to next card
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
  counterText: {
    fontSize: 16,
    fontWeight: '600',
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
  tagsContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    margin: 2,
  },
  tagText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '500',
  },
  instructions: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
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
});