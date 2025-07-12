import { useState, useEffect } from 'react';
import { Text, View, Switch, Platform, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const DAILY_NOTIFICATION_ID = 'daily-revision-reminder';

export default function NotificationSettings() {
  if (Platform.OS === 'web') {
    return null;
  }

  const [areNotificationsEnabled, setAreNotificationsEnabled] = useState(false);
  const [notificationTime, setNotificationTime] = useState(new Date());
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme];

  useEffect(() => {
    const checkNotificationStatus = async () => {
      const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
      const isScheduled = scheduledNotifications.some(
        (notif) => notif.identifier === DAILY_NOTIFICATION_ID
      );
      setAreNotificationsEnabled(isScheduled);
    };

    checkNotificationStatus();

    const subscription = Notifications.addNotificationReceivedListener(notification => {
      if (notification.request.identifier === DAILY_NOTIFICATION_ID) {
        scheduleDailyNotification(notificationTime);
      }
    });

    return () => subscription.remove();
  }, [notificationTime]);

  const handleToggleSwitch = async (value: boolean) => {
    if (value) {
      setTimePickerVisible(true);
    } else {
      await cancelDailyNotification();
      setAreNotificationsEnabled(false);
      Alert.alert('Notifications Disabled', 'You will no longer receive daily reminders.');
    }
  };

  const handleTimeChange = async (event: any, selectedTime?: Date) => {
    setTimePickerVisible(false);
    if (selectedTime) {
      setNotificationTime(selectedTime);
      const success = await scheduleDailyNotification(selectedTime);
      if (success) {
        setAreNotificationsEnabled(true);
        Alert.alert('Notifications Enabled', `You will receive a reminder every day at ${selectedTime.toLocaleTimeString()}`);
      }
    }
  };

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: themeColors.background,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: themeColors.icon,
      marginVertical: 20,
    },
    label: {
      fontSize: 16,
      color: themeColors.text,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Enable daily reminders</Text>
      <Switch
        onValueChange={handleToggleSwitch}
        value={areNotificationsEnabled}
        trackColor={{ false: '#767577', true: themeColors.tint }}
        thumbColor={areNotificationsEnabled ? themeColors.background : themeColors.background}
      />
      {isTimePickerVisible && (
        <DateTimePicker
          value={notificationTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

async function scheduleDailyNotification(time: Date) {
  const hasPermissions = await registerForPushNotificationsAsync();
  if (!hasPermissions) {
    return false;
  }

  const now = new Date();
  const triggerDate = new Date();
  triggerDate.setHours(time.getHours(), time.getMinutes(), 0, 0);

  if (now > triggerDate) {
    // If it's already past the selected time, schedule for tomorrow
    triggerDate.setDate(triggerDate.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_NOTIFICATION_ID,
    content: {
      title: 'Time to revise! 🧠',
      body: 'Review your flashcards for today.',
    },
    trigger: triggerDate,
  });
  return true;
}

async function cancelDailyNotification() {
  await Notifications.cancelScheduledNotificationAsync(DAILY_NOTIFICATION_ID);
}

async function registerForPushNotificationsAsync(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    Alert.alert('Permissions Required', 'Failed to get push token for push notification. Please enable notifications in your settings.');
    return false;
  }
  return true;
}
