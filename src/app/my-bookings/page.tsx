"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Hourglass,
  Trash2
} from "lucide-react"
import { format } from "date-fns"
import { nb } from "date-fns/locale"

interface Booking {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  status: string
  statusNote: string | null
  resource: {
    id: string
    name: string
    location: string | null
  }
  resourcePart: {
    name: string
  } | null
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  pending: { label: "Venter", icon: Hourglass, className: "status-pending" },
  approved: { label: "Godkjent", icon: CheckCircle2, className: "status-approved" },
  rejected: { label: "Avslått", icon: XCircle, className: "status-rejected" },
  cancelled: { label: "Kansellert", icon: XCircle, className: "status-cancelled" }
}

export default function MyBookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?callbackUrl=/my-bookings")
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetch("/api/bookings")
        .then(res => res.json())
        .then(data => {
          setBookings(data)
          setIsLoading(false)
        })
    }
  }, [session])

  const handleCancel = async (bookingId: string) => {
    setIsProcessing(true)
    
    const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })

    if (response.ok) {
      setBookings(bookings.map(b => 
        b.id === bookingId ? { ...b, status: "cancelled" } : b
      ))
    }
    
    setIsProcessing(false)
    setCancellingId(null)
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
        <Footer />
      </div>
    )
  }

  // Only show pending/approved as upcoming, rejected/cancelled go to separate section
  const upcomingBookings = bookings.filter(b => 
    new Date(b.startTime) >= new Date() && 
    (b.status === "pending" || b.status === "approved")
  )
  const cancelledBookings = bookings.filter(b => 
    b.status === "rejected" || b.status === "cancelled"
  )
  const pastBookings = bookings.filter(b => 
    new Date(b.startTime) < new Date() && 
    b.status !== "rejected" && b.status !== "cancelled"
  )

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mine bookinger</h1>
        <p className="text-gray-500 mb-8">Oversikt over alle dine bookinger</p>

        {bookings.length === 0 ? (
          <div className="card p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen bookinger</h2>
            <p className="text-gray-500 mb-6">Du har ikke booket noe enda</p>
            <Link href="/resources" className="btn btn-primary">
              Se fasiliteter
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Upcoming */}
            {upcomingBookings.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Kommende ({upcomingBookings.length})
                </h2>
                <div className="space-y-3">
                  {upcomingBookings.map((booking) => {
                    const statusInfo = statusConfig[booking.status]
                    const StatusIcon = statusInfo.icon
                    return (
                      <div key={booking.id} className="card p-5 hover:shadow-md transition-shadow">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-gray-900">{booking.title}</h3>
                              <span className={`status-badge ${statusInfo.className}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusInfo.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {booking.resource.name}
                              {booking.resourcePart && ` → ${booking.resourcePart.name}`}
                            </p>
                            {booking.resource.location && (
                              <p className="text-sm text-gray-500 flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {booking.resource.location}
                              </p>
                            )}
                            {booking.status === "rejected" && booking.statusNote && (
                              <p className="text-sm text-red-600 mt-2 flex items-start gap-1">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                {booking.statusNote}
                              </p>
                            )}
                          </div>
                          <div className="text-left md:text-right flex flex-col items-start md:items-end gap-2">
                            <div>
                              <p className="font-medium text-gray-900">
                                {format(new Date(booking.startTime), "EEEE d. MMMM", { locale: nb })}
                              </p>
                              <p className="text-sm text-gray-500 flex items-center gap-1 md:justify-end">
                                <Clock className="w-4 h-4" />
                                {format(new Date(booking.startTime), "HH:mm")} - {format(new Date(booking.endTime), "HH:mm")}
                              </p>
                            </div>
                            {(booking.status === "pending" || booking.status === "approved") && (
                              <button
                                onClick={() => setCancellingId(booking.id)}
                                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                              >
                                <Trash2 className="w-4 h-4" />
                                Kanseller
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Cancelled/Rejected */}
            {cancelledBookings.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-500 mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-400" />
                  Avslåtte/Kansellerte ({cancelledBookings.length})
                </h2>
                <div className="space-y-3 opacity-70">
                  {cancelledBookings.map((booking) => {
                    const statusInfo = statusConfig[booking.status]
                    const StatusIcon = statusInfo.icon
                    return (
                      <div key={booking.id} className="card p-4 border-l-4 border-red-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-700">{booking.title}</h3>
                              <span className={`status-badge text-xs ${statusInfo.className}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusInfo.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">
                              {booking.resource.name}
                              {booking.resourcePart && ` → ${booking.resourcePart.name}`}
                            </p>
                            {booking.statusNote && (
                              <p className="text-sm text-red-600 mt-1 flex items-start gap-1">
                                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                {booking.statusNote}
                              </p>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {format(new Date(booking.startTime), "d. MMM yyyy", { locale: nb })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Past */}
            {pastBookings.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-500 mb-4">
                  Tidligere ({pastBookings.length})
                </h2>
                <div className="space-y-3 opacity-70">
                  {pastBookings.slice(0, 10).map((booking) => {
                    const statusInfo = statusConfig[booking.status]
                    const StatusIcon = statusInfo.icon
                    return (
                      <div key={booking.id} className="card p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-700">{booking.title}</h3>
                              <span className={`status-badge text-xs ${statusInfo.className}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusInfo.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{booking.resource.name}</p>
                          </div>
                          <p className="text-sm text-gray-500">
                            {format(new Date(booking.startTime), "d. MMM yyyy", { locale: nb })}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </div>
        )}
        </div>
      </main>
      <Footer />

      {/* Cancel confirmation modal */}
      {cancellingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Kanseller booking?</h3>
            <p className="text-gray-600 mb-4">
              Er du sikker på at du vil kansellere denne bookingen? Administrator vil bli varslet.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancellingId(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => handleCancel(cancellingId)}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  "Ja, kanseller"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

