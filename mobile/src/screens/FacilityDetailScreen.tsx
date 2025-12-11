import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Resource } from '../types'
import { RootStackParamList } from '../navigation/AppNavigator'

// Using production URL for testing
const API_BASE_URL = 'https://arena-booking.vercel.app'

type RouteProps = RouteProp<RootStackParamList, 'FacilityDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export default function FacilityDetailScreen() {
  const route = useRoute<RouteProps>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  
  const [resource, setResource] = useState<Resource | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)

  useEffect(() => {
    fetchResource()
  }, [id])

  async function fetchResource() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/resources/${id}`)
      if (response.ok) {
        const data = await response.json()
        setResource(data)
      }
    } catch (error) {
      console.error('Error fetching resource:', error)
    } finally {
      setIsLoading(false)
    }
  }

  function handleBooking() {
    navigation.navigate('BookingForm', {
      resourceId: id,
      resourcePartId: selectedPartId || undefined,
    })
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    )
  }

  if (!resource) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Fasilitet ikke funnet</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Image */}
        {resource.image ? (
          <Image source={{ uri: resource.image }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholderImage]}>
            <Ionicons name="business" size={64} color="#94a3b8" />
          </View>
        )}

        {/* Info */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.name}>{resource.name}</Text>
            {resource.category && (
              <View style={[styles.categoryBadge, { backgroundColor: resource.category.color + '20' }]}>
                <Text style={[styles.categoryText, { color: resource.category.color }]}>
                  {resource.category.name}
                </Text>
              </View>
            )}
          </View>

          {resource.location && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color="#64748b" />
              <Text style={styles.infoText}>{resource.location}</Text>
            </View>
          )}

          {resource.description && (
            <Text style={styles.description}>{resource.description}</Text>
          )}

          {/* Booking info */}
          <View style={styles.bookingInfo}>
            {resource.requiresApproval && (
              <View style={styles.warningBox}>
                <Ionicons name="information-circle" size={20} color="#f59e0b" />
                <Text style={styles.warningText}>
                  Denne fasiliteten krever godkjenning fra administrator
                </Text>
              </View>
            )}

            {resource.minBookingMinutes && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Minimum varighet:</Text>
                <Text style={styles.infoValue}>{resource.minBookingMinutes} minutter</Text>
              </View>
            )}

            {resource.maxBookingMinutes && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Maksimum varighet:</Text>
                <Text style={styles.infoValue}>{resource.maxBookingMinutes} minutter</Text>
              </View>
            )}
          </View>

          {/* Parts selection */}
          {resource.parts.length > 0 && (
            <View style={styles.partsSection}>
              <Text style={styles.sectionTitle}>Velg del (valgfritt)</Text>
              <Text style={styles.sectionSubtitle}>
                Velg en spesifikk del, eller book hele fasiliteten
              </Text>

              <TouchableOpacity
                style={[
                  styles.partOption,
                  !selectedPartId && styles.partOptionSelected
                ]}
                onPress={() => setSelectedPartId(null)}
              >
                <View style={styles.partInfo}>
                  <Text style={styles.partName}>Hele fasiliteten</Text>
                </View>
                {!selectedPartId && (
                  <Ionicons name="checkmark-circle" size={24} color="#2563eb" />
                )}
              </TouchableOpacity>

              {resource.parts.map(part => (
                <TouchableOpacity
                  key={part.id}
                  style={[
                    styles.partOption,
                    selectedPartId === part.id && styles.partOptionSelected
                  ]}
                  onPress={() => setSelectedPartId(part.id)}
                >
                  <View style={styles.partInfo}>
                    <Text style={styles.partName}>{part.name}</Text>
                    {part.description && (
                      <Text style={styles.partDescription}>{part.description}</Text>
                    )}
                  </View>
                  {selectedPartId === part.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Book button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.bookButton} onPress={handleBooking}>
          <Text style={styles.bookButtonText}>Book nå</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
  },
  scrollView: {
    flex: 1,
  },
  image: {
    width: '100%',
    height: 200,
  },
  placeholderImage: {
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 15,
    color: '#64748b',
  },
  description: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 20,
  },
  bookingInfo: {
    marginBottom: 24,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 12,
    gap: 12,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  partsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  partOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  partOptionSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  partInfo: {
    flex: 1,
  },
  partName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  partDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  bookButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
})

