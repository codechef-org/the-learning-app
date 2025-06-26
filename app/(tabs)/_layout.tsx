import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { IconButton } from 'react-native-paper';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useAuth } from '@/context/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#667eea',
        headerShown: true,
        headerStyle: {
          backgroundColor: '#1a1a1a',
          borderBottomWidth: 0,
          shadowOpacity: 0.3,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          elevation: 8,
        },
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '600',
          color: '#ffffff',
        },
        headerTitleAlign: 'center',
        headerRight: () => (
          <IconButton
            icon="logout"
            mode="contained"
            size={20}
            onPress={handleLogout}
            style={{ backgroundColor: '#dc3545', marginRight: 8 }}
          />
        ),
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: 'rgba(26, 26, 26, 0.95)',
            backdropFilter: 'blur(20px)',
            borderTopWidth: 0,
            shadowOpacity: 0.3,
            shadowOffset: { width: 0, height: -2 },
            shadowRadius: 8,
          },
          default: {
            backgroundColor: '#1a1a1a',
            borderTopWidth: 0,
            elevation: 8,
            shadowOpacity: 0.3,
            shadowOffset: { width: 0, height: -2 },
            shadowRadius: 8,
          },
        }),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginBottom: 4,
          color: '#ffffff',
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
        tabBarInactiveTintColor: '#888888',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Learn',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="book.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Revise',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="arrow.clockwise" color={color} />,
        }}
      />
    </Tabs>
  );
}
