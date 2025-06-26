import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ActivityIndicator, Button, Card, List, Surface } from 'react-native-paper';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { supabase } from '@/lib/supabase';

interface LearningMethod {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  is_active: boolean;
}

export default function LearnScreen() {
  const [showMethods, setShowMethods] = useState(false);
  const [learningMethods, setLearningMethods] = useState<LearningMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLearningMethods();
  }, []);

  const fetchLearningMethods = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('learning_methods')
        .select('id, name, description, system_prompt, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setLearningMethods(data || []);
    } catch (err) {
      console.error('Error fetching learning methods:', err);
      setError('Failed to load learning methods. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartLearning = () => {
    if (learningMethods.length > 0) {
      setShowMethods(true);
    } else {
      // Retry fetching if no methods available
      fetchLearningMethods();
    }
  };

  const handleMethodSelect = (method: LearningMethod) => {
    // TODO: Navigate to chat interface with selected method
    console.log(`Selected method: ${method.name}`);
    console.log(`System prompt: ${method.system_prompt}`);
  };

  const getMethodIcon = (methodName: string): string => {
    const iconMap: { [key: string]: string } = {
      'Socratic Method': 'help-circle',
      'Feynman Technique': 'school',
      'Active Recall': 'brain',
      'Elaborative Learning': 'connection',
      'Problem-Based Learning': 'puzzle',
    };
    return iconMap[methodName] || 'book-open';
  };

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.loadingText}>Loading learning methods...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedView style={styles.headerContainer}>
          <ThemedText type="title" style={styles.title}>
            Ready to Learn?
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Choose your preferred learning method and start your journey
          </ThemedText>
        </ThemedView>

        {error && (
          <ThemedView style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
            <Button mode="outlined" onPress={fetchLearningMethods} style={styles.retryButton}>
              Retry
            </Button>
          </ThemedView>
        )}

        {!showMethods ? (
          <ThemedView style={styles.startContainer}>
            <Surface style={styles.startSurface} elevation={2}>
              <ThemedText type="subtitle" style={styles.startTitle}>
                Begin Your Learning Journey
              </ThemedText>
              <ThemedText style={styles.startDescription}>
                Discover various learning methods tailored to your learning style.
                Each method uses proven pedagogical techniques to enhance your understanding.
              </ThemedText>
              <Button
                mode="contained"
                onPress={handleStartLearning}
                style={styles.startButton}
                contentStyle={styles.buttonContent}
                disabled={learningMethods.length === 0}
              >
                Start Learning
              </Button>
              {learningMethods.length === 0 && !loading && (
                <ThemedText style={styles.noMethodsText}>
                  No learning methods available
                </ThemedText>
              )}
            </Surface>
          </ThemedView>
        ) : (
          <ThemedView style={styles.methodsContainer}>
            <ThemedText type="subtitle" style={styles.methodsTitle}>
              Choose Your Learning Method
            </ThemedText>
            
            {learningMethods.map((method) => (
              <Card key={method.id} style={styles.methodCard} mode="outlined">
                <Card.Content>
                  <List.Item
                    title={method.name}
                    description={method.description}
                    left={(props) => <List.Icon {...props} icon={getMethodIcon(method.name)} />}
                    right={(props) => <List.Icon {...props} icon="chevron-right" />}
                    onPress={() => handleMethodSelect(method)}
                  />
                </Card.Content>
              </Card>
            ))}

            <Button
              mode="outlined"
              onPress={() => setShowMethods(false)}
              style={styles.backButton}
            >
              Back to Start
            </Button>
          </ThemedView>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 20,
  },
  startContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startSurface: {
    padding: 30,
    borderRadius: 15,
    alignItems: 'center',
    maxWidth: 350,
    width: '100%',
  },
  startTitle: {
    marginBottom: 15,
    textAlign: 'center',
  },
  startDescription: {
    textAlign: 'center',
    marginBottom: 25,
    opacity: 0.8,
    lineHeight: 22,
  },
  startButton: {
    marginTop: 10,
  },
  buttonContent: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  methodsContainer: {
    flex: 1,
  },
  methodsTitle: {
    marginBottom: 20,
    textAlign: 'center',
  },
  methodCard: {
    marginBottom: 12,
  },
  backButton: {
    marginTop: 20,
    marginBottom: 10,
  },
  loadingText: {
    marginTop: 15,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: 15,
    color: '#d32f2f',
  },
  retryButton: {
    marginTop: 10,
  },
  noMethodsText: {
    marginTop: 15,
    textAlign: 'center',
    opacity: 0.6,
    fontSize: 14,
  },
});
