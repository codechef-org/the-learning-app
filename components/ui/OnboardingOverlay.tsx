import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Animated } from 'react-native';
import { ThemedText } from '../ThemedText';
import { ThemedView } from '../ThemedView';
import { useThemeColor } from '@/hooks/useThemeColor';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface OnboardingOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

const OnboardingOverlay: React.FC<OnboardingOverlayProps> = ({ isVisible, onClose }) => {
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const tintColor = useThemeColor({}, 'tint');

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(screenHeight)).current;

  React.useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 15,
          stiffness: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, fadeAnim, slideAnim]);

  if (!isVisible && fadeAnim.__getValue() === 0) {
    return null;
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: fadeAnim }]}>
      <Animated.View style={[styles.modalContainer, { backgroundColor: backgroundColor, transform: [{ translateY: slideAnim }] }]}>
        <ThemedText style={styles.title}>Welcome to Flashcards!</ThemedText>
        <ThemedText style={styles.subtitle}>Master your knowledge with these simple gestures:</ThemedText>

        <View style={styles.gestureContainer}>
          <View style={styles.gestureRow}>
            <ThemedText style={styles.gestureIcon}>⬅️</ThemedText>
            <View style={styles.gestureTextContainer}>
              <ThemedText style={styles.gestureLabel}>Swipe Left</ThemedText>
              <ThemedText style={styles.gestureDescription}>Forgot / Again</ThemedText>
            </View>
          </View>
          <View style={styles.gestureRow}>
            <ThemedText style={styles.gestureIcon}>➡️</ThemedText>
            <View style={styles.gestureTextContainer}>
              <ThemedText style={styles.gestureLabel}>Swipe Right</ThemedText>
              <ThemedText style={styles.gestureDescription}>Got it! / Good</ThemedText>
            </View>
          </View>
          <View style={styles.gestureRow}>
            <ThemedText style={styles.gestureIcon}>⬆️</ThemedText>
            <View style={styles.gestureTextContainer}>
              <ThemedText style={styles.gestureLabel}>Swipe Up</ThemedText>
              <ThemedText style={styles.gestureDescription}>Too Easy / Easy</ThemedText>
            </View>
          </View>
          <View style={styles.gestureRow}>
            <ThemedText style={styles.gestureIcon}>⬇️</ThemedText>
            <View style={styles.gestureTextContainer}>
              <ThemedText style={styles.gestureLabel}>Swipe Down</ThemedText>
              <ThemedText style={styles.gestureDescription}>Challenging / Hard</ThemedText>
            </View>
          </View>
          <View style={styles.gestureRow}>
            <ThemedText style={styles.gestureIcon}>👆</ThemedText>
            <View style={styles.gestureTextContainer}>
              <ThemedText style={styles.gestureLabel}>Tap Card</ThemedText>
              <ThemedText style={styles.gestureDescription}>Flip to see answer</ThemedText>
            </View>
          </View>
          <View style={styles.gestureRow}>
            <ThemedText style={styles.gestureIcon}> ✋</ThemedText>
            <View style={styles.gestureTextContainer}>
              <ThemedText style={styles.gestureLabel}>Long Press</ThemedText>
              <ThemedText style={styles.gestureDescription}>Delete Card</ThemedText>
            </View>
          </View>
        </View>

        <TouchableOpacity style={[styles.button, { backgroundColor: tintColor }]} onPress={onClose}>
          <ThemedText style={[styles.buttonText, { color: backgroundColor }]}>Got It!</ThemedText>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  modalContainer: {
    width: screenWidth * 0.85,
    maxWidth: 400,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 25,
    textAlign: 'center',
    opacity: 0.8,
  },
  gestureContainer: {
    width: '100%',
    marginBottom: 30,
  },
  gestureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  gestureIcon: {
    fontSize: 30,
    marginRight: 15,
    width: 40, // Fixed width for alignment
    textAlign: 'center',
  },
  gestureTextContainer: {
    flex: 1,
  },
  gestureLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  gestureDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 15,
    marginTop: 10,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default OnboardingOverlay;
