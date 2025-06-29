import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
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
  const { user } = useAuth();

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

  const renderMethodCard = ({ item }: { item: LearningMethod }) => (
    <TouchableOpacity
      style={[styles.methodCard, { borderLeftColor: item.color }]}
      onPress={() => handleMethodSelect(item)}
    >
      <View style={styles.methodHeader}>
        <Text style={styles.methodIcon}>{getIcon(item.icon)}</Text>
        <Text style={styles.methodName}>{item.name}</Text>
      </View>
      <Text style={styles.methodDescription}>{item.description}</Text>
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
      <View style={styles.loadingContainer}>
        <Text>Loading learning methods...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Choose Your Learning Method</Text>
      <Text style={styles.subtitle}>
        Select a learning approach that works best for you
      </Text>
      
      <FlatList
        data={methods}
        renderItem={renderMethodCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={showTopicModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTopicModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedMethod?.name}
            </Text>
            <Text style={styles.modalSubtitle}>
              What would you like to learn about?
            </Text>
            
            <TextInput
              style={styles.topicInput}
              placeholder="Enter a topic (e.g., React Native, Machine Learning, Spanish)"
              value={topic}
              onChangeText={setTopic}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowTopicModal(false);
                  setTopic('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.startButton]}
                onPress={handleStartLearning}
                disabled={!topic.trim()}
              >
                <Text style={styles.startButtonText}>Start Learning</Text>
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
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  methodCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
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
    color: '#1a1a1a',
    flex: 1,
  },
  methodDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    minHeight: 300,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  topicInput: {
    borderWidth: 1,
    borderColor: '#ddd',
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
    backgroundColor: '#f0f0f0',
  },
  startButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
}); 