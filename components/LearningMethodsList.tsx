import { useColorScheme } from '@/hooks/useColorScheme';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface LearningMethod {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  icon: string;
  color: string;
}

interface LearningMethodsListProps {
  onSelectMethod: (method: LearningMethod, topic: string, chatId: string) => void;
}

export default function LearningMethodsList({ onSelectMethod }: LearningMethodsListProps) {
  const [methods, setMethods] = useState<LearningMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<LearningMethod | null>(null);
  const [topic, setTopic] = useState('');
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const { user } = useAuth();
  const colorScheme = useColorScheme();

  // Theme colors
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#121212' : '#f8f9fa';
  const cardBackgroundColor = isDark ? '#2c2c2c' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1a1a';
  const subtitleColor = isDark ? '#cccccc' : '#666';
  const modalBackgroundColor = isDark ? '#2c2c2c' : '#ffffff';
  const inputBackgroundColor = isDark ? '#333333' : '#ffffff';
  const inputBorderColor = isDark ? '#555555' : '#ddd';
  const inputTextColor = isDark ? '#ffffff' : '#000000';
  const cancelButtonColor = isDark ? '#444444' : '#f0f0f0';

  useEffect(() => {
    loadLearningMethods();
  }, []);

  const loadLearningMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_methods')
        .select('*')
        .order('name');

      if (error) throw error;
      setMethods(data || []);
    } catch (error) {
      console.error('Error loading learning methods:', error);
      Alert.alert('Error', 'Failed to load learning methods');
    } finally {
      setLoading(false);
    }
  };

  const handleMethodSelect = (method: LearningMethod) => {
    setSelectedMethod(method);
    setShowTopicModal(true);
  };

  const handleStartLearning = async () => {
    if (!selectedMethod || !topic.trim()) {
      Alert.alert('Error', 'Please enter a topic to learn about');
      return;
    }

    try {
      // Create a new chat
      const { data: chat, error } = await supabase
        .from('chats')
        .insert({
          user_id: user?.id,
          learning_method_id: selectedMethod.id,
          title: `${selectedMethod.name}: ${topic}`,
          topic: topic.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      // Close modal and navigate to chat
      setShowTopicModal(false);
      setTopic('');
      onSelectMethod(selectedMethod, topic.trim(), chat.id);
      
      // Now passing the actual chat.id to the chat screen
      
    } catch (error) {
      console.error('Error creating chat session:', error);
      Alert.alert('Error', 'Failed to start learning session');
    }
  };

  const renderMethodCard = (method: LearningMethod) => (
    <TouchableOpacity
      key={method.id}
      style={[
        styles.methodCard,
        { 
          borderLeftColor: method.color,
          backgroundColor: cardBackgroundColor,
          shadowColor: isDark ? '#000' : '#000',
        }
      ]}
      onPress={() => handleMethodSelect(method)}
    >
      <View style={styles.methodHeader}>
        <Text style={styles.methodIcon}>{getIcon(method.icon)}</Text>
        <Text style={[styles.methodName, { color: textColor }]}>{method.name}</Text>
      </View>
      <Text style={[styles.methodDescription, { color: subtitleColor }]}>
        {method.description}
      </Text>
    </TouchableOpacity>
  );

  const getIcon = (iconName: string) => {
    const icons: { [key: string]: string } = {
      'help-circle': '❓',
      'lightbulb': '💡',
      'refresh': '🔄',
      'calendar': '📅',
      'message-circle': '💬',
    };
    return icons[iconName] || '📚';
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <Text style={[styles.loadingText, { color: subtitleColor }]}>Loading learning methods...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Text style={[styles.title, { color: textColor }]}>Choose Your Learning Method</Text>
      <Text style={[styles.subtitle, { color: subtitleColor }]}>
        Select a method that matches your learning style
      </Text>
      
      <View style={styles.listContainer}>
        {methods.map(renderMethodCard)}
      </View>

      <Modal
        visible={showTopicModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopicModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: modalBackgroundColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>What would you like to learn?</Text>
            <Text style={[styles.modalSubtitle, { color: subtitleColor }]}>
              Enter a topic you&apos;d like to explore with {selectedMethod?.name}
            </Text>
            
            <TextInput
              style={[
                styles.topicInput,
                { 
                  backgroundColor: inputBackgroundColor,
                  borderColor: inputBorderColor,
                  color: inputTextColor
                }
              ]}
              value={topic}
              onChangeText={setTopic}
              placeholder="e.g., Python programming, World War 2, Calculus..."
              placeholderTextColor={subtitleColor}
              multiline
              autoFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { backgroundColor: cancelButtonColor }]}
                onPress={() => setShowTopicModal(false)}
              >
                <Text style={[styles.buttonText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.startButton]}
                onPress={handleStartLearning}
                disabled={!topic.trim() || startingChat}
              >
                <Text style={[styles.buttonText, { color: '#ffffff' }]}>
                  {startingChat ? 'Starting...' : 'Start Learning'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  methodCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  methodIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  methodName: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  methodDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    minHeight: 300,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  topicInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
  },
  startButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 