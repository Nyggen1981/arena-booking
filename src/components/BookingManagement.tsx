"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { nb } from "date-fns/locale"
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2, 
  Loader2,
  Calendar,
  User,
  Building2,
  History,
  Square,
  CheckSquare
} from "lucide-react"

interface Booking {
  id: string
  title: string
  startTime: string
  endTime: string
  status: string
  resource: {
    id: string
    name: string
    color?: string
  }
  resourcePart?: {
    id: string
    name: string
  } | null
  user: {
    name: string | null
    email: string
  }
}

interface BookingManagementProps {
  initialBookings?: Booking[]
  showTabs?: boolean
}

export function BookingManagement({ initialBookings, showTabs = true }: BookingManagementProps) {
  const [bookings, setBookings] = useState<Booking[]>(initialBookings || [])
  const [isLoading, setIsLoading] = useState(!initialBookings)
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected" | "history">("pending")
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  
  const now = new Date()
  
  // Clear selection when tab changes
  useEffect(() => {
    setSelectedIds(new Set())
  }, [activeTab])

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/admin/bookings")
      if (response.ok) {
        const data = await response.json()
        setBookings(data)
      }
    } catch (error) {
      console.error("Failed to fetch bookings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAction = async (bookingId: string, action: "approve" | "reject" | "cancel") => {
    setProcessingId(bookingId)
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: action === "cancel" ? "reject" : action,
          statusNote: action === "cancel" ? "Kansellert av administrator" : undefined
        })
      })

      if (response.ok) {
        // Refresh bookings
        await fetchBookings()
      }
    } catch (error) {
      console.error("Failed to process booking:", error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async (bookingId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne bookingen permanent?")) {
      return
    }
    
    setProcessingId(bookingId)
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "DELETE"
      })

      if (response.ok) {
        await fetchBookings()
      }
    } catch (error) {
      console.error("Failed to delete booking:", error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    
    if (!confirm(`Er du sikker på at du vil slette ${selectedIds.size} booking${selectedIds.size > 1 ? "er" : ""} permanent?`)) {
      return
    }
    
    setIsDeleting(true)
    try {
      const response = await fetch("/api/admin/bookings/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingIds: Array.from(selectedIds) })
      })

      if (response.ok) {
        setSelectedIds(new Set())
        await fetchBookings()
      }
    } catch (error) {
      console.error("Failed to bulk delete bookings:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSelection = (bookingId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId)
      } else {
        newSet.add(bookingId)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredBookings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredBookings.map(b => b.id)))
    }
  }

  const canDelete = activeTab === "rejected" || activeTab === "history"

  const filteredBookings = bookings.filter(b => {
    const isPast = new Date(b.endTime) < now
    
    if (activeTab === "pending") return b.status === "pending" && !isPast
    if (activeTab === "approved") return b.status === "approved" && !isPast
    if (activeTab === "rejected") return (b.status === "rejected" || b.status === "cancelled") && !isPast
    if (activeTab === "history") return isPast
    return true
  }).sort((a, b) => {
    // Sort by date - newest first for history, oldest first for others
    if (activeTab === "history") {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    }
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })

  const pendingCount = bookings.filter(b => b.status === "pending" && new Date(b.endTime) >= now).length
  const approvedCount = bookings.filter(b => b.status === "approved" && new Date(b.endTime) >= now).length
  const rejectedCount = bookings.filter(b => (b.status === "rejected" || b.status === "cancelled") && new Date(b.endTime) >= now).length
  const historyCount = bookings.filter(b => new Date(b.endTime) < now).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div>
      {/* Tabs */}
      {showTabs && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === "pending"
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            Ventende
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("approved")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === "approved"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Godkjente
            {approvedCount > 0 && (
              <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                {approvedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === "rejected"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <XCircle className="w-4 h-4" />
            Avslåtte
            {rejectedCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {rejectedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === "history"
                ? "bg-gray-200 text-gray-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <History className="w-4 h-4" />
            Historikk
            {historyCount > 0 && (
              <span className="bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full">
                {historyCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Bulk actions bar */}
      {canDelete && filteredBookings.length > 0 && (
        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {selectedIds.size === filteredBookings.length ? (
              <CheckSquare className="w-5 h-5 text-blue-600" />
            ) : (
              <Square className="w-5 h-5" />
            )}
            {selectedIds.size === filteredBookings.length ? "Fjern alle" : "Velg alle"}
          </button>
          
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Slett valgte ({selectedIds.size})
            </button>
          )}
        </div>
      )}

      {/* Booking list */}
      {filteredBookings.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            {activeTab === "pending" && <Clock className="w-8 h-8 text-gray-400" />}
            {activeTab === "approved" && <CheckCircle2 className="w-8 h-8 text-gray-400" />}
            {activeTab === "rejected" && <XCircle className="w-8 h-8 text-gray-400" />}
            {activeTab === "history" && <History className="w-8 h-8 text-gray-400" />}
          </div>
          <p className="text-gray-500">
            {activeTab === "pending" && "Ingen ventende bookinger"}
            {activeTab === "approved" && "Ingen kommende godkjente bookinger"}
            {activeTab === "rejected" && "Ingen avslåtte bookinger"}
            {activeTab === "history" && "Ingen tidligere bookinger"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((booking) => (
            <div 
              key={booking.id} 
              className={`card p-4 hover:shadow-md transition-shadow ${
                selectedIds.has(booking.id) ? "ring-2 ring-blue-500 bg-blue-50/50" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Checkbox for deletable tabs */}
                {canDelete && (
                  <button
                    onClick={() => toggleSelection(booking.id)}
                    className="flex-shrink-0 mt-1"
                  >
                    {selectedIds.has(booking.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                    )}
                  </button>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: booking.resource.color || "#3b82f6" }}
                    />
                    <h3 className="font-medium text-gray-900 truncate">{booking.title}</h3>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {booking.resource.name}
                      {booking.resourcePart && ` → ${booking.resourcePart.name}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(booking.startTime), "d. MMM yyyy", { locale: nb })}
                      {" "}
                      {format(new Date(booking.startTime), "HH:mm")} - {format(new Date(booking.endTime), "HH:mm")}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {booking.user.name || booking.user.email}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {activeTab === "history" ? (
                    // Show status badge + delete button for historical bookings
                    <>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        booking.status === "approved" 
                          ? "bg-green-100 text-green-600" 
                          : booking.status === "cancelled"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-red-100 text-red-600"
                      }`}>
                        {booking.status === "approved" && "Gjennomført"}
                        {booking.status === "cancelled" && "Kansellert"}
                        {booking.status === "rejected" && "Avslått"}
                        {booking.status === "pending" && "Utløpt"}
                      </span>
                      <button
                        onClick={() => handleDelete(booking.id)}
                        disabled={processingId === booking.id}
                        className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Slett permanent"
                      >
                        {processingId === booking.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    </>
                  ) : activeTab === "rejected" ? (
                    // Show status badge + delete button for rejected bookings
                    <>
                      <span className="px-3 py-1 rounded-full bg-red-100 text-red-600 text-sm">
                        {booking.status === "cancelled" ? "Kansellert" : "Avslått"}
                      </span>
                      <button
                        onClick={() => handleDelete(booking.id)}
                        disabled={processingId === booking.id}
                        className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Slett permanent"
                      >
                        {processingId === booking.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Trash2 className="w-5 h-5" />
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      {booking.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleAction(booking.id, "approve")}
                            disabled={processingId === booking.id}
                            className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors disabled:opacity-50"
                            title="Godkjenn"
                          >
                            {processingId === booking.id ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-5 h-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleAction(booking.id, "reject")}
                            disabled={processingId === booking.id}
                            className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors disabled:opacity-50"
                            title="Avslå"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {booking.status === "approved" && (
                        <button
                          onClick={() => handleAction(booking.id, "cancel")}
                          disabled={processingId === booking.id}
                          className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
                          title="Kanseller"
                        >
                          {processingId === booking.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Trash2 className="w-5 h-5" />
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

