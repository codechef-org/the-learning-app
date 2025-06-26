import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { IconButton } from 'react-native-paper';

interface ModernHeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: {
    icon: string;
    onPress: () => void;
  };
  rightAction?: {
    icon: string;
    onPress: () => void;
  };
  showGradient?: boolean;
}

export default function ModernHeader({ 
  title, 
  subtitle, 
  leftAction, 
  rightAction, 
  showGradient = true 
}: ModernHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const headerContent = (
    <View style={styles.container}>
      <View style={styles.content}>
        {leftAction && (
          <IconButton
            icon={leftAction.icon}
            mode="contained-tonal"
            size={20}
            onPress={leftAction.onPress}
            style={styles.actionButton}
            iconColor={showGradient ? '#fff' : colors.text}
          />
        )}
        
        <View style={styles.titleContainer}>
          <Text style={[
            styles.title, 
            { color: showGradient ? '#fff' : colors.text }
          ]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[
              styles.subtitle, 
              { color: showGradient ? 'rgba(255,255,255,0.9)' : colors.text }
            ]}>
              {subtitle}
            </Text>
          )}
        </View>
        
        {rightAction ? (
          <IconButton
            icon={rightAction.icon}
            mode="contained-tonal"
            size={20}
            onPress={rightAction.onPress}
            style={styles.actionButton}
            iconColor={showGradient ? '#fff' : colors.text}
          />
        ) : (
          <View style={styles.actionButton} />
        )}
      </View>
    </View>
  );

  if (showGradient) {
    return (
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientContainer}
      >
        {headerContent}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.gradientContainer, { backgroundColor: colors.background }]}>
      {headerContent}
    </View>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 2,
  },
  actionButton: {
    margin: 0,
    width: 40,
    height: 40,
  },
}); 