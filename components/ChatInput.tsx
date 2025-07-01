import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ChatInput({ 
  onSend, 
  placeholder = "Type your message...", 
  disabled = false
}: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSend(trimmedMessage);
      setMessage('');
    }
  };

  const canSend = message.trim().length > 0 && !disabled;

  return (
    <View style={styles.container}>
      <View style={[
        styles.inputContainer,
      ]}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[
              styles.textInput,
              disabled && styles.textInputDisabled,
            ]}
            value={message}
            onChangeText={setMessage}
            placeholder={placeholder}
            placeholderTextColor="#999"
            multiline
            maxLength={1000}
            editable={!disabled}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              canSend ? styles.sendButtonActive : styles.sendButtonInactive,
            ]}
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.sendButtonText,
                canSend ? styles.sendButtonTextActive : styles.sendButtonTextInactive,
              ]}
            >
              ➤
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8f9fa',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 120,
    paddingVertical: 12,
    paddingRight: 8,
    color: '#000',
  },
  textInputDisabled: {
    color: '#999',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonActive: {
    backgroundColor: '#007AFF',
  },
  sendButtonInactive: {
    backgroundColor: '#e0e0e0',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sendButtonTextActive: {
    color: '#FFFFFF',
  },
  sendButtonTextInactive: {
    color: '#999',
  },
}); 