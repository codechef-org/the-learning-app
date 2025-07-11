import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
   ActivityIndicator,
   Button,
   Card,
   Paragraph,
   Title,
} from 'react-native-paper';

export default function AuthCallbackScreen() {
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = useLocalSearchParams();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // For web, Supabase automatically handles the callback
      // We just need to check the session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }

      if (session) {
        setSuccess(true);
      } else {
        // Try to handle URL hash parameters for email confirmation
        if (typeof window !== 'undefined') {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (sessionError) {
              throw sessionError;
            }
            
            setSuccess(true);
          } else {
            throw new Error('No valid session found');
          }
        }
      }
    } catch (err: any) {
      console.error('Email verification error:', err);
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (success) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/sign-in');
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content style={styles.content}>
          {loading ? (
            <>
              <ActivityIndicator size="large" style={styles.loader} />
              <Title style={styles.title}>Verifying Email...</Title>
              <Paragraph style={styles.text}>
                Please wait while we verify your email address.
              </Paragraph>
            </>
          ) : success ? (
            <>
              <Title style={[styles.title, styles.successTitle]}>
                Email Verified! ✅
              </Title>
              <Paragraph style={styles.text}>
                Your email has been successfully verified. You can now access your account.
              </Paragraph>
              <Button
                mode="contained"
                onPress={handleContinue}
                style={styles.button}
              >
                Continue to App
              </Button>
            </>
          ) : (
            <>
              <Title style={[styles.title, styles.errorTitle]}>
                Verification Failed ❌
              </Title>
              <Paragraph style={styles.text}>
                {error || 'There was an error verifying your email. Please try again.'}
              </Paragraph>
              <Button
                mode="contained"
                onPress={handleContinue}
                style={styles.button}
              >
                Back to Sign In
              </Button>
            </>
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  card: {
    padding: 20,
    borderRadius: 12,
    elevation: 4,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loader: {
    marginBottom: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 24,
    fontWeight: 'bold',
  },
  successTitle: {
    color: '#28a745',
  },
  errorTitle: {
    color: '#dc3545',
  },
  text: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
}); 