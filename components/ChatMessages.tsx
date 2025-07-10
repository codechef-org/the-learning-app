import React, { useEffect, useRef } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import Markdown from 'react-native-markdown-display';

import { useColorScheme } from '@/hooks/useColorScheme';

export interface Message {
  id: string;
  text: string;
  createdAt: Date;
  isUser: boolean;
  senderName: string;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading?: boolean;
  learningMethodName: string;
}

export default function ChatMessages({ 
  messages, 
  isLoading = false,
  learningMethodName 
}: ChatMessagesProps) {
  const colorScheme = useColorScheme();
  const scrollViewRef = useRef<ScrollView>(null);

  // Theme colors
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#121212' : '#f8f9fa';
  const assistantBubbleColor = isDark ? '#2c2c2c' : '#FFFFFF';
  const assistantTextColor = isDark ? '#ffffff' : '#000000';
  const assistantBorderColor = isDark ? '#444444' : '#e0e0e0';
  const senderNameColor = isDark ? '#cccccc' : '#666';
  const timestampColor = isDark ? '#cccccc' : '#666';
  const loadingTextColor = isDark ? '#cccccc' : '#666';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const getMarkdownStyles = () => ({
    body: {
      color: assistantTextColor,
      fontSize: 16,
      lineHeight: 20,
      margin: 0,
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 8,
    },
    strong: {
      fontWeight: 'bold' as 'bold',
    },
    em: {
      fontStyle: 'italic' as 'italic',
    },
    code_inline: {
      backgroundColor: isDark ? '#3c3c3c' : '#f0f0f0',
      color: assistantTextColor,
      padding: 2,
      borderRadius: 3,
      fontFamily: 'Courier',
      fontSize: 14,
    },
    code_block: {
      backgroundColor: isDark ? '#2a2a2a' : '#f8f8f8',
      color: assistantTextColor,
      padding: 10,
      borderRadius: 5,
      fontFamily: 'Courier',
      fontSize: 14,
      marginVertical: 8,
    },
    blockquote: {
      backgroundColor: isDark ? '#2a2a2a' : '#f9f9f9',
      borderLeftWidth: 4,
      borderLeftColor: isDark ? '#555' : '#ddd',
      paddingLeft: 10,
      marginVertical: 8,
    },
    list_item: {
      marginVertical: 2,
      flexDirection: 'row' as 'row',
      alignItems: 'flex-start' as 'flex-start',
    },
    bullet_list: {
      marginVertical: 8,
    },
    ordered_list: {
      marginVertical: 8,
    },
    heading1: {
      fontSize: 20,
      fontWeight: 'bold',
      marginVertical: 8,
      color: assistantTextColor,
    },
    heading2: {
      fontSize: 18,
      fontWeight: 'bold',
      marginVertical: 6,
      color: assistantTextColor,
    },
    heading3: {
      fontSize: 16,
      fontWeight: 'bold',
      marginVertical: 4,
      color: assistantTextColor,
    },
    link: {
      color: '#007AFF',
      textDecorationLine: 'underline',
    },
    hr: {
      backgroundColor: isDark ? '#555' : '#ddd',
      height: 1,
      marginVertical: 10,
    },
  });

  const renderMessage = (message: Message) => {
    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          message.isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            message.isUser ? styles.userBubble : [styles.assistantBubble, { 
              backgroundColor: assistantBubbleColor,
              borderColor: assistantBorderColor 
            }],
          ]}
        >
          {!message.isUser && (
            <Text style={[styles.senderName, { color: senderNameColor }]}>{message.senderName}</Text>
          )}
          
          {message.isUser ? (
            <Text
              style={[
                styles.messageText,
                styles.userMessageText,
              ]}
            >
              {message.text}
            </Text>
          ) : (
            <Markdown style={getMarkdownStyles() as any}>
              {message.text}
            </Markdown>
          )}
          
          <Text
            style={[
              styles.timestamp,
              message.isUser ? styles.userTimestamp : [styles.assistantTimestamp, { color: timestampColor }],
            ]}
          >
            {message.createdAt.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    );
  };

  const renderLoadingIndicator = () => {
    if (!isLoading) return null;
    
    return (
      <View style={[styles.messageContainer, styles.assistantMessageContainer]}>
        <View style={[styles.messageBubble, styles.assistantBubble, { 
          backgroundColor: assistantBubbleColor,
          borderColor: assistantBorderColor 
        }]}>
          <Text style={[styles.senderName, { color: senderNameColor }]}>{learningMethodName}</Text>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: loadingTextColor }]}>●</Text>
            <Text style={[styles.loadingText, styles.loadingDot2, { color: loadingTextColor }]}>●</Text>
            <Text style={[styles.loadingText, styles.loadingDot3, { color: loadingTextColor }]}>●</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      style={[styles.container, { backgroundColor }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {messages.map(renderMessage)}
      {renderLoadingIndicator()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  assistantMessageText: {
    color: '#000000',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
    opacity: 0.7,
  },
  userTimestamp: {
    color: '#FFFFFF',
    textAlign: 'right',
  },
  assistantTimestamp: {
    color: '#666',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  loadingText: {
    fontSize: 20,
    marginHorizontal: 2,
  },
  loadingDot2: {
    opacity: 0.7,
  },
  loadingDot3: {
    opacity: 0.4,
  },
}); 