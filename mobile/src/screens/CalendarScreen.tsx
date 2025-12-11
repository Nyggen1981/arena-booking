import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { 
  format, 
  startOfWeek, 
  addDays, 
  isSameDay,
  parseISO,
  startOfDay,
  endOfDay,
} from 'date-fns'
import { nb } from 'date-fns/locale'
import { Booking } from '../types'

// Using production URL for testing
const API_BASE_URL = 'https://arena-booking.vercel.app'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const fetchBookings = useCallback(async () => {
    try {
      const start = format(startOfDay(weekStart), 'yyyy-MM-dd')
      const end = format(endOfDay(addDays(weekStart, 6)), 'yyyy-MM-dd')
      
      const response = await fetch(
        `${API_BASE_URL}/api/calendar?start=${start}&end=${end}`
      )
      
      if (response.ok) {
        const data = await response.json()
        setBookings(data.bookings || data)
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [weekStart])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchBookings()
  }, [fetchBookings])

  const navigateWeek = (direction: 'prev' | 'next') => {
    setSelectedDate(current => addDays(current, direction === 'next' ? 7 : -7))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#22c55e'
      case 'pending': return '#f59e0b'
      case 'rejected': return '#ef4444'
      default: return '#6b7280'
    }
  }

  const dayBookings = bookings.filter(b => 
    isSameDay(parseISO(b.startTime), selectedDate)
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kalender</Text>
        
        <View style={styles.weekNav}>
          <TouchableOpacity onPress={() => navigateWeek('prev')}>
            <Ionicons name="chevron-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          
          <Text style={styles.weekLabel}>
            {format(weekStart, 'd. MMM', { locale: nb })} - {format(addDays(weekStart, 6), 'd. MMM yyyy', { locale: nb })}
          </Text>
          
          <TouchableOpacity onPress={() => navigateWeek('next')}>
            <Ionicons name="chevron-forward" size={24} color="#1e293b" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.daysHeader}>
        {weekDays.map(day => (
          <TouchableOpacity
            key={day.toISOString()}
            style={[
              styles.dayHeader,
              isSameDay(day, new Date()) && styles.todayHeader,
              isSameDay(day, selectedDate) && styles.selectedHeader,
            ]}
            onPress={() => setSelectedDate(day)}
          >
            <Text style={[
              styles.dayName,
              isSameDay(day, selectedDate) && styles.selectedDayName,
            ]}>
              {format(day, 'EEE', { locale: nb })}
            </Text>
            <Text style={[
              styles.dayNumber,
              isSameDay(day, selectedDate) && styles.selectedDayNumber,
            ]}>
              {format(day, 'd')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Text style={styles.selectedDateLabel}>
            {format(selectedDate, "EEEE d. MMMM", { locale: nb })}
          </Text>
          
          {dayBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>Ingen bookinger denne dagen</Text>
            </View>
          ) : (
            dayBookings
              .sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime())
              .map(booking => (
                <View
                  key={booking.id}
                  style={[
                    styles.bookingCard,
                    { borderLeftColor: getStatusColor(booking.status) }
                  ]}
                >
                  <View style={styles.bookingTime}>
                    <Text style={styles.timeText}>
                      {format(parseISO(booking.startTime), 'HH:mm')}
                    </Text>
                    <Text style={styles.timeSeparator}>-</Text>
                    <Text style={styles.timeText}>
                      {format(parseISO(booking.endTime), 'HH:mm')}
                    </Text>
                  </View>
                  
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingTitle}>{booking.title}</Text>
                    <Text style={styles.bookingResource}>
                      {booking.resource?.name}
                      {booking.resourcePart && ` - ${booking.resourcePart.name}`}
                    </Text>
                  </View>
                </View>
              ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  daysHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 4,
  },
  dayHeader: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  todayHeader: {
    backgroundColor: '#dbeafe',
  },
  selectedHeader: {
    backgroundColor: '#2563eb',
  },
  dayName: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  selectedDayName: {
    color: '#fff',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  selectedDayNumber: {
    color: '#fff',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  selectedDateLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
    marginTop: 12,
  },
  bookingCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bookingTime: {
    alignItems: 'center',
    marginRight: 16,
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  timeSeparator: {
    fontSize: 12,
    color: '#94a3b8',
    marginVertical: 2,
  },
  bookingInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  bookingResource: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
})

