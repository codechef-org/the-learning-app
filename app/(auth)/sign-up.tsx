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

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { signUp } = useAuth();

  const showErrorMessage = (message: string) => {
    if (Platform.OS === 'web') {
      // Use Snackbar on web
      setErrorMessage(message);
      setShowError(true);
      setShowSuccess(false);
    } else {
      // Use native Alert on mobile platforms
      Alert.alert('Error', message);
    }
  };

  const showSuccessMessage = (message: string) => {
    if (Platform.OS === 'web') {
      // Use Snackbar on web
      setSuccessMessage(message);
      setShowSuccess(true);
      setShowError(false);
      // Navigate to sign-in after a delay
      setTimeout(() => {
        router.replace('/(auth)/sign-in');
      }, 3000);
    } else {
      // Use native Alert on mobile platforms
      Alert.alert(
        'Success',
        message,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/sign-in'),
          },
        ]
      );
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      showErrorMessage('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      showErrorMessage('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      showErrorMessage('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password);

    if (error) {
      showErrorMessage(error.message || 'Sign up failed');
    } else {
      showSuccessMessage('Account created successfully! Please check your email to verify your account.');
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
            <Title style={styles.title}>Create Account</Title>
            <Paragraph style={styles.subtitle}>
              Join us and start your learning adventure
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

            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry={!showConfirmPassword}
              right={
                <TextInput.Icon
                  icon={showConfirmPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              }
              style={styles.input}
            />

            <Button
              mode="contained"
              onPress={handleSignUp}
              loading={loading}
              disabled={loading}
              style={styles.button}
            >
              Create Account
            </Button>

            <View style={styles.footer}>
              <Text>Already have an account? </Text>
              <Link href="/(auth)/sign-in" asChild>
                <Text style={styles.link}>Sign In</Text>
              </Link>
            </View>
          </View>
        </Surface>
      </ScrollView>
      
      {Platform.OS === 'web' && (
        <>
          <Snackbar
            visible={showError}
            onDismiss={() => setShowError(false)}
            duration={4000}
            style={styles.errorSnackbar}
            action={{
              label: 'Dismiss',
              onPress: () => setShowError(false),
            }}
          >
            {errorMessage}
          </Snackbar>

          <Snackbar
            visible={showSuccess}
            onDismiss={() => setShowSuccess(false)}
            duration={6000}
            style={styles.successSnackbar}
            action={{
              label: 'Sign In',
              onPress: () => {
                setShowSuccess(false);
                router.replace('/(auth)/sign-in');
              },
            }}
          >
            {successMessage}
          </Snackbar>
        </>
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
  errorSnackbar: {
    backgroundColor: '#d32f2f',
  },
  successSnackbar: {
    backgroundColor: '#2e7d32',
  },
}); 