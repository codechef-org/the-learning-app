import ChatHistory from '@/components/ChatHistory';
import ChatScreen from '@/components/ChatScreen';
import LearningMethodsList from '@/components/LearningMethodsList';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

interface Chat {
  id: string;
  title: string;
  topic: string;
  status: string;
  created_at: string;
  updated_at: string;
  learning_method: {
    id: string;
    name: string;
    description: string;
    system_prompt: string;
    icon: string;
    color: string;
  };
}

export default function LearnScreen() {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [showLearningMethods, setShowLearningMethods] = useState(false);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Dynamic header control based on chat state
  useEffect(() => {
    if (currentSession || showLearningMethods) {
      // Hide header when chat is active
      navigation.setOptions({ headerShown: false });
    } else {
      // Show header when on start screen or learning methods
      navigation.setOptions({ headerShown: true });
    }
  }, [currentSession, navigation, showLearningMethods]);

  const handleStartLearning = () => {
    setShowLearningMethods(true);
    setShowStartScreen(false);
  };

  const handleMethodSelect = async (method: LearningMethod, topic: string, chatId: string) => {
    // Now using the actual chat ID from the database
    setCurrentSession({
      id: chatId,
      learning_method: method,
      topic: topic,
    });
    setShowStartScreen(false);
    setShowLearningMethods(false);
  };

  const handleChatSelect = (chat: Chat) => {
    // Resume an existing chat from history
    setCurrentSession({
      id: chat.id,
      learning_method: chat.learning_method,
      topic: chat.topic,
    });
    setShowStartScreen(false);
    setShowLearningMethods(false);
  };

  const handleBack = () => {
    setCurrentSession(null);
    setShowStartScreen(true);
    setShowLearningMethods(false);
  };

  const handleBackToStart = () => {
    setShowLearningMethods(false);
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
        <StatusBar style="dark" />
        <View style={[styles.sessionHeader, { paddingTop: insets.top }]}>
          <IconButton
            icon="arrow-left"
            mode="contained"
            size={20}
            onPress={handleBack}
            style={[styles.backButton, { backgroundColor: '#667eea' }]}
          />
          <View style={styles.sessionInfo}>
            <ThemedText type="defaultSemiBold" style={styles.sessionTitle}>
              {currentSession.learning_method.name}
            </ThemedText>
            <ThemedText style={styles.sessionTopic}>
              {currentSession.topic}
            </ThemedText>
          </View>
          <Button
            mode="contained"
            onPress={handleMarkComplete}
            style={styles.completeButton}
            buttonColor="#4CAF50"
            textColor="#ffffff"
            compact
          >
            Complete
          </Button>
        </View>
        
        <View style={styles.chatContainer}>
          <ChatScreen
            chatId={currentSession.id}
            systemPrompt={currentSession.learning_method.system_prompt}
            learningMethodName={currentSession.learning_method.name}
            topic={currentSession.topic}
            onMarkComplete={handleMarkComplete}
          />
        </View>
      </View>
    );
  }

  if (showLearningMethods) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.backButtonContainer, { paddingTop: insets.top }]}>
          <IconButton
            icon="arrow-left"
            mode="contained"
            size={20}
            onPress={handleBackToStart}
            style={[styles.backButton, { backgroundColor: '#667eea' }]}
          />
        </View>
        

        
        <View style={styles.methodsContainer}>
          <LearningMethodsList onSelectMethod={handleMethodSelect} />
        </View>
      </ThemedView>
    );
  }

  if (showStartScreen) {
    return (
      <ThemedView style={styles.container}>

        
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ThemedView style={styles.startLearningContainer}>
            <ThemedText type="title" style={styles.welcomeTitle}>
              AI Learning Assistant
            </ThemedText>
            <ThemedText style={styles.welcomeSubtitle}>
              Ready to start your learning journey? Get personalized AI tutoring on any topic you would like to explore.
            </ThemedText>
            
            <Button
              mode="contained"
              onPress={handleStartLearning}
              style={styles.startLearningButton}
              contentStyle={styles.startLearningButtonContent}
              buttonColor="#667eea"
              textColor="#ffffff"
              icon="school"
            >
              Start Learning
            </Button>
          </ThemedView>
          
          <ChatHistory onChatSelect={handleChatSelect} />
        </ScrollView>
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
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButtonContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  spacer: {
    width: 40,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  sessionInfo: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  sessionTitle: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  sessionTopic: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  backButton: {
    margin: 0,
  },
  completeButton: {
    borderRadius: 8,
  },
  logoutButton: {
    margin: 0,
  },
  methodsWelcomeContainer: {
    padding: 20,
    alignItems: 'center',
  },
  methodsTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  methodsSubtitle: {
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 20,
  },
  startLearningContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  welcomeTitle: {
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 40,
  },
  welcomeSubtitle: {
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 20,
    lineHeight: 22,
    marginBottom: 40,
  },
  startLearningButton: {
    marginTop: 20,
    paddingVertical: 4,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  startLearningButtonContent: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  methodsContainer: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});
