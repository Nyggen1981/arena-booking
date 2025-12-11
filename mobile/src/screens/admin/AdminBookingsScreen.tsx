import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { format, parseISO } from 'date-fns'
import { nb } from 'date-fns/locale'
import { Booking } from '../../types'

// Using production URL for testing
const API_BASE_URL = 'https://arena-booking.vercel.app'

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'

export default function AdminBookingsScreen() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  
  // Reject modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const fetchBookings = useCallback(async () => {
    try {
      const url = filter === 'all'
        ? `${API_BASE_URL}/api/admin/bookings`
        : `${API_BASE_URL}/api/admin/bookings?status=${filter}`
      
      const response = await fetch(url, { credentials: 'include' })
      
      if (response.ok) {
        const data = await response.json()
        setBookings(data)
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }, [filter])

  useEffect(() => {
    setIsLoading(true)
    fetchBookings()
  }, [fetchBookings])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchBookings()
  }, [fetchBookings])

  const handleAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    setProcessingId(id)
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, statusNote: reason }),
      })

      if (response.ok) {
        fetchBookings()
      } else {
        Alert.alert('Feil', 'Kunne ikke utfore handlingen')
      }
    } catch (error) {
      Alert.alert('Feil', 'Noe gikk galt')
    } finally {
      setProcessingId(null)
      setRejectModalVisible(false)
      setRejectingId(null)
      setRejectReason('')
    }
  }

  const openRejectModal = (id: string) => {
    setRejectingId(id)
    setRejectModalVisible(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#22c55e'
      case 'pending': return '#f59e0b'
      case 'rejected': return '#ef4444'
      case 'cancelled': return '#6b7280'
      default: return '#6b7280'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Godkjent'
      case 'pending': return 'Venter'
      case 'rejected': return 'Avslatt'
      case 'cancelled': return 'Kansellert'
      default: return status
    }
  }

  const renderBooking = ({ item }: { item: Booking }) => (
    <View style={[
      styles.bookingCard,
      { borderLeftColor: getStatusColor(item.status) }
    ]}>
      <View style={styles.bookingHeader}>
        <Text style={styles.bookingTitle}>{item.title}</Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) + '20' }
        ]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>

      <Text style={styles.bookingResource}>
        {item.resource?.name}
        {item.resourcePart && ` - ${item.resourcePart.name}`}
      </Text>

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color="#64748b" />
          <Text style={styles.detailText}>
            {item.user?.name || item.user?.email}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#64748b" />
          <Text style={styles.detailText}>
            {format(parseISO(item.startTime), "EEE d. MMM yyyy, HH:mm", { locale: nb })}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#64748b" />
          <Text style={styles.detailText}>
            {format(parseISO(item.startTime), "HH:mm")} - {format(parseISO(item.endTime), "HH:mm")}
          </Text>
        </View>
      </View>

      {item.status === 'pending' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => openRejectModal(item.id)}
            disabled={processingId === item.id}
          >
            <Ionicons name="close" size={18} color="#ef4444" />
            <Text style={styles.rejectButtonText}>Avslag</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleAction(item.id, 'approve')}
            disabled={processingId === item.id}
          >
            {processingId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={styles.approveButtonText}>Godkjenn</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )

  const filters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Alle' },
    { key: 'pending', label: 'Venter' },
    { key: 'approved', label: 'Godkjent' },
    { key: 'rejected', label: 'Avslatt' },
  ]

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Alle bookinger</Text>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              filter === f.key && styles.filterChipActive
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[
              styles.filterText,
              filter === f.key && styles.filterTextActive
            ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
      ) : (
        <FlatList
          data={bookings}
          renderItem={renderBooking}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>Ingen bookinger funnet</Text>
            </View>
          }
        />
      )}

      {/* Reject Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Avslag booking</Text>
            <Text style={styles.modalSubtitle}>
              Legg til en valgfri grunn for avslaget
            </Text>
            
            <TextInput
              style={styles.modalInput}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Grunn for avslag..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setRejectModalVisible(false)
                  setRejectingId(null)
                  setRejectReason('')
                }}
              >
                <Text style={styles.modalCancelText}>Avbryt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => {
                  if (rejectingId) {
                    handleAction(rejectingId, 'reject', rejectReason)
                  }
                }}
              >
                {processingId ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Avslag</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#fff',
  },
  loader: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  bookingCard: {
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
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookingResource: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  bookingDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#64748b',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  rejectButton: {
    backgroundColor: '#fef2f2',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  approveButton: {
    backgroundColor: '#22c55e',
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
    height: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
})

