import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, IconButton } from 'react-native-paper';

export default function ExploreScreen() {

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.heroSection}>
          <ThemedText type="title" style={styles.title}>
            Revision Center
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Review and reinforce your learning with interactive flashcards and quizzes
          </ThemedText>
        </View>

        <View style={styles.comingSoonSection}>
          <Card style={styles.featureCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <IconButton
                  icon="cards"
                  size={40}
                  iconColor="#667eea"
                  style={styles.featureIcon}
                />
              </View>
              <ThemedText type="defaultSemiBold" style={styles.featureTitle}>
                Smart Flashcards
              </ThemedText>
              <ThemedText style={styles.featureDescription}>
                AI-generated flashcards based on your learning sessions
              </ThemedText>
            </Card.Content>
          </Card>

          <Card style={styles.featureCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <IconButton
                  icon="head-question"
                  size={40}
                  iconColor="#764ba2"
                  style={styles.featureIcon}
                />
              </View>
              <ThemedText type="defaultSemiBold" style={styles.featureTitle}>
                Practice Quizzes
              </ThemedText>
              <ThemedText style={styles.featureDescription}>
                Test your knowledge with adaptive quiz questions
              </ThemedText>
            </Card.Content>
          </Card>

          <Card style={styles.featureCard}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <IconButton
                  icon="chart-line"
                  size={40}
                  iconColor="#f093fb"
                  style={styles.featureIcon}
                />
              </View>
              <ThemedText type="defaultSemiBold" style={styles.featureTitle}>
                Progress Tracking
              </ThemedText>
              <ThemedText style={styles.featureDescription}>
                Monitor your learning progress and retention rates
              </ThemedText>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.comingSoonBadge}>
          <ThemedText style={styles.comingSoonText}>
            Coming Soon
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  comingSoonSection: {
    flex: 1,
    gap: 16,
    paddingBottom: 20,
  },
  featureCard: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderRadius: 12,
  },
  cardContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  iconContainer: {
    marginBottom: 8,
  },
  featureIcon: {
    margin: 0,
  },
  featureTitle: {
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDescription: {
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  comingSoonBadge: {
    alignSelf: 'center',
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 20,
  },
  comingSoonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
