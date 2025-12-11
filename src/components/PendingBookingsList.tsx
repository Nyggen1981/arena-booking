"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Check, 
  Loader2,
  Calendar,
  Clock,
  User,
  MapPin,
  ChevronDown,
  XCircle
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { nb } from "date-fns/locale"

interface Booking {
  id: string
  title: string
  resourceName: string
  resourcePartName: string | null
  userName: string
  startTime: string
  endTime: string
}

interface Props {
  bookings: Booking[]
}

export function PendingBookingsList({ bookings: initialBookings }: Props) {
  const router = useRouter()
  const [bookings, setBookings] = useState(initialBookings)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const handleApprove = useCallback(async (id: string) => {
    setLoadingId(id)
    
    try {
      const response = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" })
      })

      if (response.ok) {
        setBookings(prev => prev.filter(b => b.id !== id))
        router.refresh()
      }
    } catch (error) {
      console.error("Error approving booking:", error)
    } finally {
      setLoadingId(null)
    }
  }, [router])

  const handleReject = useCallback(async (id: string, reason?: string) => {
    setLoadingId(id)
    
    try {
      const response = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "reject",
          statusNote: reason || undefined
        })
      })

      if (response.ok) {
        setBookings(prev => prev.filter(b => b.id !== id))
        setRejectingId(null)
        setRejectReason("")
        router.refresh()
      }
    } catch (error) {
      console.error("Error rejecting booking:", error)
    } finally {
      setLoadingId(null)
    }
  }, [router])

  if (bookings.length === 0) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-gray-600">Ingen ventende bookinger 🎉</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-gray-100">
        {bookings.map((booking) => {
          const isExpanded = expandedId === booking.id
          const isLoading = loadingId === booking.id
          const startDate = parseISO(booking.startTime)
          const endDate = parseISO(booking.endTime)

          return (
            <div key={booking.id} className="transition-colors">
              {/* Clickable header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                className="w-full p-4 hover:bg-gray-50 text-left"
                disabled={isLoading}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <h3 className="font-medium text-gray-900">{booking.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      {booking.resourceName}
                      {booking.resourcePartName && ` → ${booking.resourcePartName}`}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Av {booking.userName}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {format(startDate, "d. MMM", { locale: nb })}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(startDate, "HH:mm")} - {format(endDate, "HH:mm")}
                      </p>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>
              </button>

              {/* Expanded details with actions */}
              {isExpanded && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                  <div className="pt-4 space-y-3">
                    {/* Details */}
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {format(startDate, "EEEE d. MMMM yyyy", { locale: nb })}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {format(startDate, "HH:mm")} - {format(endDate, "HH:mm")}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {booking.resourceName}
                        {booking.resourcePartName && ` (${booking.resourcePartName})`}
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4 text-gray-400" />
                        {booking.userName}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleApprove(booking.id)}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Godkjenn
                      </button>
                      <button
                        onClick={() => setRejectingId(booking.id)}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Avslå
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reject modal */}
      {rejectingId && (() => {
        const booking = bookings.find(b => b.id === rejectingId)
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                Avslå booking?
              </h3>
              <p className="text-gray-600 text-center mb-4">
                {booking?.title} - Brukeren vil bli varslet på e-post.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Begrunnelse (valgfritt)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="F.eks. Fasiliteten er allerede booket..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRejectingId(null)
                    setRejectReason("")
                  }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Avbryt
                </button>
                <button
                  onClick={() => handleReject(rejectingId, rejectReason || undefined)}
                  disabled={loadingId === rejectingId}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loadingId === rejectingId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Avslå
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

