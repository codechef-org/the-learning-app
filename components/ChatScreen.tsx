import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import ChatInput from './ChatInput';
import ChatMessages, { Message } from './ChatMessages';

interface ChatScreenProps {
  chatId: string;
  systemPrompt: string;
  learningMethodName: string;
  topic: string;
  onMarkComplete?: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatScreen({ 
  chatId, 
  systemPrompt, 
  learningMethodName,
  topic,
  onMarkComplete 
}: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedInitially, setHasLoadedInitially] = useState(false);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Ref to track if component is mounted for cleanup
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Cancel any ongoing API requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (chatId) {
      loadChatHistory();
    }
    
    return () => {
      // Cancel any ongoing requests when chatId changes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [chatId]);

  const loadChatHistory = async () => {
    if (!isMountedRef.current) return;
    
    // Reset all states when loading a new chat
    setMessages([]);
    setIsLoading(false);
    setHasLoadedInitially(false);
    
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('message_order', { ascending: true });

      if (error) throw error;
      
      if (!isMountedRef.current) return;

      const customMessages: Message[] = messagesData.map((msg) => ({
        id: msg.id,
        text: msg.content,
        createdAt: new Date(msg.created_at),
        isUser: msg.role === 'user',
        senderName: msg.role === 'user' ? 'You' : learningMethodName,
      }));

      setMessages(customMessages);
      setHasLoadedInitially(true);

      // If this is a new chat (no messages), automatically send the first message
      if (messagesData.length === 0 && topic.trim()) {
        setTimeout(() => {
          if (isMountedRef.current) {
            sendInitialMessage();
          }
        }, 500); // Small delay to ensure UI is ready
      }
    } catch (error) {
      if (!isMountedRef.current) return;
      
      console.error('Error loading chat history:', error);
      Alert.alert('Error', 'Failed to load chat history');
      setHasLoadedInitially(true);
    }
  };

  const sendInitialMessage = async () => {
    if (!isMountedRef.current) return;
    
    const initialMessage = `I want to learn about: ${topic}`;
    
    const userMessage: Message = {
      id: Math.random().toString(),
      text: initialMessage,
      createdAt: new Date(),
      isUser: true,
      senderName: 'You',
    };

    // Add user message to UI immediately
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setIsLoading(true);

    try {
      await sendMessageToAI(initialMessage, []);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      console.error('Error sending initial message:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
      
      // Add error message
      const errorMessage: Message = {
        id: 'error-message',
        text: 'Sorry, I had trouble starting our conversation. Please try sending a message to continue.',
        createdAt: new Date(),
        isUser: false,
        senderName: learningMethodName,
      };
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const sendMessageToAI = async (messageText: string, chatHistory: ChatMessage[]) => {
    if (!isMountedRef.current) return;
    
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      // Call the Supabase Edge Function
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session?.access_token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          message: messageText,
          chatId,
          systemPrompt,
          chatHistory,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!isMountedRef.current) return;

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to get AI response');
      }

      // Add AI response to UI
      const aiMessage: Message = {
        id: Math.random().toString(),
        text: result.response,
        createdAt: new Date(),
        isUser: false,
        senderName: learningMethodName,
      };

      if (isMountedRef.current) {
        setMessages(prevMessages => [...prevMessages, aiMessage]);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was cancelled, don't show error
        return;
      }
      
      if (!isMountedRef.current) return;
      
      throw error; // Re-throw for caller to handle
    }
  };

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!isMountedRef.current || !messageText.trim()) return;

    // Validate required fields
    if (!chatId || !systemPrompt) {
      console.error('Missing required fields:', { chatId, systemPrompt });
      Alert.alert('Error', 'Chat configuration is incomplete. Please try again.');
      return;
    }

    const userMessage: Message = {
      id: Math.random().toString(),
      text: messageText.trim(),
      createdAt: new Date(),
      isUser: true,
      senderName: 'You',
    };

    // Add user message to UI immediately
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setIsLoading(true);

    try {
      // Prepare chat history for AI context
      const chatHistory: ChatMessage[] = messages
        .slice(-10) // Limit to last 10 messages for context
        .map(msg => ({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.text,
        }));

      await sendMessageToAI(messageText.trim(), chatHistory);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      
      // Remove the user message that failed to send
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg.id !== userMessage.id)
      );
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [messages, chatId, systemPrompt, learningMethodName]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top + 60}
      >
        <View style={styles.messagesContainer}>
          <ChatMessages
            messages={messages}
            isLoading={isLoading}
            learningMethodName={learningMethodName}
          />
        </View>
        <View style={styles.inputContainer}>
          <ChatInput
            onSend={handleSendMessage}
            placeholder="Ask me anything about your topic..."
            disabled={isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
  },
}); 