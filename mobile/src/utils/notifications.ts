import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

// Using production URL for testing
const API_BASE_URL = 'https://arena-booking.vercel.app'

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export interface PushNotificationToken {
  token: string
  type: 'expo' | 'fcm' | 'apns'
}

/**
 * Register for push notifications and get the token
 */
export async function registerForPushNotificationsAsync(): Promise<PushNotificationToken | null> {
  let token: PushNotificationToken | null = null

  // Physical device check
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices')
    return null
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token - permission not granted')
    return null
  }

  try {
    // Get Expo push token
    const expoPushToken = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id', // Replace with your Expo project ID
    })
    
    token = {
      token: expoPushToken.data,
      type: 'expo',
    }
  } catch (error) {
    console.error('Error getting push token:', error)
    return null
  }

  // Android specific channel setup
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563eb',
    })

    await Notifications.setNotificationChannelAsync('bookings', {
      name: 'Bookinger',
      description: 'Varsler om bookinger',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22c55e',
    })
  }

  return token
}

/**
 * Send push token to the backend
 */
export async function savePushTokenToServer(
  token: string, 
  userId: string
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users/push-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, userId }),
    })
    
    return response.ok
  } catch (error) {
    console.error('Error saving push token:', error)
    return false
  }
}

/**
 * Add notification listeners
 */
export function addNotificationListeners(
  onNotification: (notification: Notifications.Notification) => void,
  onNotificationResponse: (response: Notifications.NotificationResponse) => void
) {
  // Listener for incoming notifications while app is foregrounded
  const notificationListener = Notifications.addNotificationReceivedListener(onNotification)

  // Listener for when user taps on a notification
  const responseListener = Notifications.addNotificationResponseReceivedListener(onNotificationResponse)

  return () => {
    Notifications.removeNotificationSubscription(notificationListener)
    Notifications.removeNotificationSubscription(responseListener)
  }
}

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  trigger?: Notifications.NotificationTriggerInput
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: trigger || null, // null = immediate
  })
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync()
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number) {
  await Notifications.setBadgeCountAsync(count)
}

/**
 * Clear badge
 */
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0)
}

