// lib/supabase.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto'; // Required for Supabase to work in React Native

// Platform-aware storage adapter
const createPlatformStorage = () => {
  if (Platform.OS === 'web') {
    // Web storage using localStorage with availability check
    const isLocalStorageAvailable = () => {
      try {
        return typeof window !== 'undefined' && window.localStorage !== undefined;
      } catch {
        return false;
      }
    };

    return {
      getItem: async (key) => {
        try {
          if (!isLocalStorageAvailable()) {
            return null;
          }
          return localStorage.getItem(key);
        } catch (error) {
          console.error('localStorage.getItem error:', error);
          return null;
        }
      },
      setItem: async (key, value) => {
        try {
          if (!isLocalStorageAvailable()) {
            return;
          }
          localStorage.setItem(key, value);
        } catch (error) {
          console.error('localStorage.setItem error:', error);
        }
      },
      removeItem: async (key) => {
        try {
          if (!isLocalStorageAvailable()) {
            return;
          }
          localStorage.removeItem(key);
        } catch (error) {
          console.error('localStorage.removeItem error:', error);
        }
      },
    };
  } else {
    // Mobile storage using AsyncStorage
    return AsyncStorage;
  }
};

// Get these values from your Supabase project settings -> API
// In Expo, environment variables must be prefixed with EXPO_PUBLIC_ to be accessible in the client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createPlatformStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web', // Enable URL detection on web for OAuth flows
  },
});