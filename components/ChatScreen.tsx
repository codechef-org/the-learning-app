import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Bubble, GiftedChat, IMessage, Send } from 'react-native-gifted-chat';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedInitially, setHasLoadedInitially] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadChatHistory();
  }, [chatId]);

  const loadChatHistory = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('message_order', { ascending: true });

      if (error) throw error;

      const giftedMessages: IMessage[] = messagesData
        .map((msg, index) => ({
          _id: msg.id,
          text: msg.content,
          createdAt: new Date(msg.created_at),
          user: {
            _id: msg.role === 'user' ? 1 : 2,
            name: msg.role === 'user' ? 'You' : learningMethodName,
            avatar: msg.role === 'assistant' ? '🤖' : undefined,
          },
        }))
        .reverse(); // Gifted Chat expects newest messages first

      setMessages(giftedMessages);
      setHasLoadedInitially(true);

      // If this is a new chat (no messages), automatically send the first message
      if (messagesData.length === 0 && topic.trim()) {
        setTimeout(() => {
          sendInitialMessage();
        }, 500); // Small delay to ensure UI is ready
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      Alert.alert('Error', 'Failed to load chat history');
      setHasLoadedInitially(true);
    }
  };

  const sendInitialMessage = async () => {
    const initialMessage = `I want to learn about: ${topic}`;
    
    const userMessage: IMessage = {
      _id: Math.random().toString(),
      text: initialMessage,
      createdAt: new Date(),
      user: {
        _id: 1,
        name: 'You',
      },
    };

    // Add user message to UI immediately
    setMessages(previousMessages => GiftedChat.append(previousMessages, [userMessage]));
    setIsLoading(true);

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
          message: initialMessage,
          chatId,
          systemPrompt,
          chatHistory: [],
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to get AI response');
      }

      // Add AI response to UI
      const aiMessage: IMessage = {
        _id: Math.random().toString(),
        text: result.response,
        createdAt: new Date(),
        user: {
          _id: 2,
          name: learningMethodName,
          avatar: '🤖',
        },
      };

      setMessages(previousMessages => GiftedChat.append(previousMessages, [aiMessage]));
    } catch (error) {
      console.error('Error sending initial message:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
      
      // Remove the user message that failed to send
      setMessages(previousMessages => 
        previousMessages.filter(msg => msg._id !== userMessage._id)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onSend = useCallback(async (newMessages: IMessage[] = []) => {
    const userMessage = newMessages[0];
    if (!userMessage || !userMessage.text || !userMessage.text.trim()) {
      console.error('Invalid message:', userMessage);
      return;
    }

    // Validate required fields before sending
    if (!chatId || !systemPrompt) {
      console.error('Missing required fields:', { chatId, systemPrompt });
      Alert.alert('Error', 'Chat configuration is incomplete. Please try again.');
      return;
    }

    // Add user message to UI immediately
    setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));
    setIsLoading(true);

    try {
      // Prepare chat history for AI context
      const chatHistory: ChatMessage[] = messages
        .slice(0, 10) // Limit to last 10 messages for context
        .reverse() // Convert back to chronological order
        .map(msg => ({
          role: msg.user._id === 1 ? 'user' : 'assistant',
          content: msg.text,
        }));

      // Call the Supabase Edge Function
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session?.access_token) {
        throw new Error('No authentication token available');
      }

      console.log(chatId);
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          message: userMessage.text.trim(),
          chatId,
          systemPrompt,
          chatHistory,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to get AI response');
      }

      // Add AI response to UI
      const aiMessage: IMessage = {
        _id: Math.random().toString(),
        text: result.response,
        createdAt: new Date(),
        user: {
          _id: 2,
          name: learningMethodName,
          avatar: '🤖',
        },
      };

      setMessages(previousMessages => GiftedChat.append(previousMessages, [aiMessage]));
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      
      // Remove the user message that failed to send
      setMessages(previousMessages => 
        previousMessages.filter(msg => msg._id !== userMessage._id)
      );
    } finally {
      setIsLoading(false);
    }
  }, [messages, chatId, systemPrompt, learningMethodName]);

  const renderBubble = (props: any) => {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: {
            backgroundColor: '#007AFF',
          },
          left: {
            backgroundColor: '#E5E5EA',
          },
        }}
        textStyle={{
          right: {
            color: '#FFFFFF',
          },
          left: {
            color: '#000000',
          },
        }}
      />
    );
  };

  const renderSend = (props: any) => {
    return (
      <Send
        {...props}
        disabled={isLoading}
        containerStyle={styles.sendContainer}
      >
        <View style={[
          styles.sendButton, 
          { opacity: isLoading ? 0.5 : 1 }
        ]}>
          <View style={styles.sendButtonInner}>
            <Text style={styles.sendButtonText}>➤</Text>
          </View>
        </View>
      </Send>
    );
  };

  return (
    <View style={styles.container}>
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{
          _id: 1,
        }}
        placeholder={`Ask me anything about your topic...`}
        renderBubble={renderBubble}
        renderSend={renderSend}
        isLoadingEarlier={isLoading}
        showUserAvatar={false}
        alwaysShowSend={true}
        keyboardShouldPersistTaps="never"
        textInputProps={{
          editable: !isLoading,
          style: {
            borderWidth: 1,
            borderColor: '#e0e0e0',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            marginHorizontal: 8,
            marginVertical: 4,
            maxHeight: 100,
          },
        }}
        bottomOffset={0}
        minInputToolbarHeight={60}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100%',
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 44,
  },
  sendButton: {
    borderRadius: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 44,
    minHeight: 32,
  },
  sendButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 