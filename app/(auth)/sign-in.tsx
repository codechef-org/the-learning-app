import { useAuth } from '@/context/AuthContext';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Button,
  Paragraph,
  Snackbar,
  Surface,
  Text,
  TextInput,
  Title,
} from 'react-native-paper';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const { signIn } = useAuth();

  const showErrorMessage = (message: string) => {
    if (Platform.OS === 'web') {
      // Use Snackbar on web
      setErrorMessage(message);
      setShowError(true);
    } else {
      // Use native Alert on mobile platforms
      Alert.alert('Error', message);
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      showErrorMessage('Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);

    if (error) {
      showErrorMessage(error.message || 'Sign in failed');
    } else {
      router.replace('/(tabs)');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Surface style={styles.surface}>
          <View style={styles.content}>
            <Title style={styles.title}>Welcome Back</Title>
            <Paragraph style={styles.subtitle}>
              Sign in to continue your learning journey
            </Paragraph>

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPassword}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              style={styles.input}
            />

            <Button
              mode="contained"
              onPress={handleSignIn}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Sign In
            </Button>

            <View style={styles.footer}>
              <Text>Don&apos;t have an account? </Text>
              <Link href="/(auth)/sign-up" asChild>
                <Text style={styles.link}>Sign Up</Text>
              </Link>
            </View>
          </View>
        </Surface>
      </ScrollView>
      
      {Platform.OS === 'web' && (
        <Snackbar
          visible={showError}
          onDismiss={() => setShowError(false)}
          duration={4000}
          style={styles.snackbar}
          action={{
            label: 'Dismiss',
            onPress: () => setShowError(false),
          }}
        >
          {errorMessage}
        </Snackbar>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  surface: {
    borderRadius: 8,
    padding: 20,
    elevation: 4,
  },
  content: {
    width: '100%',
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    fontSize: 16,
    opacity: 0.7,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  link: {
    color: '#6200EE',
    fontWeight: 'bold',
  },
  snackbar: {
    backgroundColor: '#d32f2f',
  },
}); 