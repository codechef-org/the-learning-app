import ChatScreen from '@/components/ChatScreen';
import LearningMethodsList from '@/components/LearningMethodsList';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useAuth } from '@/context/AuthContext';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';

interface LearningMethod {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  icon: string;
  color: string;
}

interface ChatSession {
  id: string;
  learning_method: LearningMethod;
  topic: string;
}

export default function LearnScreen() {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleMethodSelect = async (method: LearningMethod, topic: string, chatId: string) => {
    // Now using the actual chat ID from the database
    setCurrentSession({
      id: chatId,
      learning_method: method,
      topic: topic,
    });
    setShowStartScreen(false);
  };

  const handleBack = () => {
    setCurrentSession(null);
    setShowStartScreen(true);
  };

  const handleMarkComplete = () => {
    // TODO: Mark the current session as completed in the database
    console.log('Marking session as complete');
    handleBack();
  };

  if (!showStartScreen && currentSession) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Button
            mode="text"
            onPress={handleBack}
            icon="arrow-left"
            contentStyle={styles.backButtonContent}
          >
            Back
          </Button>
          <View style={styles.headerInfo}>
            <ThemedText type="defaultSemiBold" style={styles.headerTitle}>
              {currentSession.learning_method.name}
            </ThemedText>
            <ThemedText style={styles.headerTopic}>
              Topic: {currentSession.topic}
            </ThemedText>
          </View>
          <Button
            mode="outlined"
            onPress={handleMarkComplete}
            style={styles.completeButton}
          >
            Complete
          </Button>
        </View>
        
        <ChatScreen
          chatId={currentSession.id}
          systemPrompt={currentSession.learning_method.system_prompt}
          learningMethodName={currentSession.learning_method.name}
          onMarkComplete={handleMarkComplete}
        />
      </View>
    );
  }

  if (showStartScreen) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.welcomeHeader}>
          <Button
            mode="text"
            onPress={handleLogout}
            icon="logout"
            style={styles.logoutButton}
          >
            Logout
          </Button>
        </View>
        
        <ThemedView style={styles.welcomeContainer}>
          <ThemedText type="title" style={styles.welcomeTitle}>
            AI Learning Assistant
          </ThemedText>
          <ThemedText style={styles.welcomeSubtitle}>
            Choose a learning method and start exploring any topic with AI-powered tutoring
          </ThemedText>
        </ThemedView>
        
        <View style={styles.methodsContainer}>
          <LearningMethodsList onSelectMethod={handleMethodSelect} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <LearningMethodsList onSelectMethod={handleMethodSelect} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  welcomeHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  welcomeContainer: {
    padding: 20,
    paddingTop: 20,
    alignItems: 'center',
  },
  welcomeTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  methodsContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  backButtonContent: {
    flexDirection: 'row-reverse',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  headerTopic: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  completeButton: {
    borderColor: '#4CAF50',
  },
  logoutButton: {
    marginLeft: 8,
  },
});
