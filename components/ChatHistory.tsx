import { useColorScheme } from '@/hooks/useColorScheme';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

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

interface ChatHistoryProps {
  onChatSelect: (chat: Chat) => void;
}

export default function ChatHistory({ onChatSelect }: ChatHistoryProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const colorScheme = useColorScheme();

  // Theme colors
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#121212' : '#f8f9fa';
  const cardBackgroundColor = isDark ? '#2c2c2c' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#1a1a1a';
  const subtitleColor = isDark ? '#cccccc' : '#666';
  const dateColor = isDark ? '#999999' : '#999';

  useEffect(() => {
    if (user) {
      loadChatHistory();
    }
  }, [user]);

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          id,
          title,
          topic,
          status,
          created_at,
          updated_at,
          learning_methods (
            id,
            name,
            description,
            system_prompt,
            icon,
            color
          )
        `)
        .eq('user_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Transform the data to match our Chat interface
      const transformedChats: Chat[] = (data || []).map((chat: any) => ({
        id: chat.id,
        title: chat.title,
        topic: chat.topic,
        status: chat.status,
        created_at: chat.created_at,
        updated_at: chat.updated_at,
        learning_method: {
          id: chat.learning_methods?.id || '',
          name: chat.learning_methods?.name || 'Unknown Method',
          description: chat.learning_methods?.description || '',
          system_prompt: chat.learning_methods?.system_prompt || '',
          icon: chat.learning_methods?.icon || 'help-circle',
          color: chat.learning_methods?.color || '#007AFF',
        },
      }));

      setChats(transformedChats);
    } catch (error) {
      console.error('Error loading chat history:', error);
      Alert.alert('Error', 'Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'active':
        return '#007AFF';
      case 'archived':
        return '#9E9E9E';
      default:
        return '#007AFF';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'active':
        return 'Active';
      case 'archived':
        return 'Archived';
      default:
        return 'Active';
    }
  };

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

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity
      style={[
        styles.chatCard, 
        { 
          borderLeftColor: item.learning_method.color,
          backgroundColor: cardBackgroundColor,
          shadowColor: isDark ? '#000' : '#000',
        }
      ]}
      onPress={() => onChatSelect(item)}
    >
      <View style={styles.chatHeader}>
        <View style={styles.chatTitleRow}>
          <Text style={styles.chatIcon}>{getIcon(item.learning_method.icon)}</Text>
          <View style={styles.chatInfo}>
            <Text style={[styles.chatTitle, { color: textColor }]} numberOfLines={1}>
              {item.topic}
            </Text>
            <Text style={[styles.chatMethod, { color: subtitleColor }]} numberOfLines={1}>
              {item.learning_method.name}
            </Text>
          </View>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.chatDate, { color: dateColor }]}>{formatDate(item.updated_at)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={[styles.loadingText, { color: subtitleColor }]}>Loading chat history...</Text>
      </View>
    );
  }

  if (chats.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>💬</Text>
        <Text style={[styles.emptyTitle, { color: textColor }]}>No chats yet</Text>
        <Text style={[styles.emptySubtitle, { color: subtitleColor }]}>
          Start your first learning session to begin your journey
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: textColor }]}>Recent Chats</Text>
      <View style={styles.listContainer}>
        {chats.map((item) => (
          <View key={item.id}>
            {renderChatItem({ item })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  chatCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  chatHeader: {
    flex: 1,
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  chatIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  chatMethod: {
    fontSize: 14,
  },
  statusContainer: {
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  chatDate: {
    fontSize: 12,
    textAlign: 'left',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
}); 