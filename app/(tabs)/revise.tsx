import FlashcardDeck from '@/components/FlashcardDeck';
import { ThemedView } from '@/components/ThemedView';
import React from 'react';
import { StyleSheet } from 'react-native';

export default function ReviseScreen() {
  return (
    <ThemedView style={styles.container}>
    
      <FlashcardDeck />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
