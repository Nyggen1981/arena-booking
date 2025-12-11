import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'

// Screens
import LoginScreen from '../screens/LoginScreen'
import HomeScreen from '../screens/HomeScreen'
import FacilitiesScreen from '../screens/FacilitiesScreen'
import FacilityDetailScreen from '../screens/FacilityDetailScreen'
import CalendarScreen from '../screens/CalendarScreen'
import BookingsScreen from '../screens/BookingsScreen'
import ProfileScreen from '../screens/ProfileScreen'
import BookingFormScreen from '../screens/BookingFormScreen'

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen'
import AdminBookingsScreen from '../screens/admin/AdminBookingsScreen'

// Type definitions
export type RootStackParamList = {
  Login: undefined
  Main: undefined
  FacilityDetail: { id: string }
  BookingForm: { resourceId: string; resourcePartId?: string }
}

export type MainTabParamList = {
  Home: undefined
  Facilities: undefined
  Calendar: undefined
  Bookings: undefined
  Profile: undefined
}

export type AdminTabParamList = {
  Dashboard: undefined
  AdminBookings: undefined
  Profile: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator<MainTabParamList>()
const AdminTab = createBottomTabNavigator<AdminTabParamList>()

// User Tab Navigator
function UserTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home'

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline'
          } else if (route.name === 'Facilities') {
            iconName = focused ? 'business' : 'business-outline'
          } else if (route.name === 'Calendar') {
            iconName = focused ? 'calendar' : 'calendar-outline'
          } else if (route.name === 'Bookings') {
            iconName = focused ? 'list' : 'list-outline'
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline'
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Hjem' }} />
      <Tab.Screen name="Facilities" component={FacilitiesScreen} options={{ title: 'Fasiliteter' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Kalender' }} />
      <Tab.Screen name="Bookings" component={BookingsScreen} options={{ title: 'Mine bookinger' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  )
}

// Admin Tab Navigator
function AdminTabs() {
  return (
    <AdminTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home'

          if (route.name === 'Dashboard') {
            iconName = focused ? 'grid' : 'grid-outline'
          } else if (route.name === 'AdminBookings') {
            iconName = focused ? 'clipboard' : 'clipboard-outline'
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline'
          }

          return <Ionicons name={iconName} size={size} color={color} />
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <AdminTab.Screen name="Dashboard" component={AdminDashboardScreen} options={{ title: 'Dashboard' }} />
      <AdminTab.Screen name="AdminBookings" component={AdminBookingsScreen} options={{ title: 'Bookinger' }} />
      <AdminTab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </AdminTab.Navigator>
  )
}

// Main Navigator
export default function AppNavigator() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return null // Or a loading screen
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen 
              name="Main" 
              component={isAdmin ? AdminTabs : UserTabs} 
            />
            <Stack.Screen 
              name="FacilityDetail" 
              component={FacilityDetailScreen}
              options={{ headerShown: true, title: 'Fasilitet' }}
            />
            <Stack.Screen 
              name="BookingForm" 
              component={BookingFormScreen}
              options={{ headerShown: true, title: 'Ny booking' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}

