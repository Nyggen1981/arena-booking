"use client"

import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, List, Grid3X3, Calendar, Clock, MapPin } from "lucide-react"
import { 
  format, 
  startOfWeek, 
  startOfMonth,
  endOfMonth,
  addDays, 
  addWeeks, 
  addMonths,
  subWeeks,
  subMonths,
  isSameDay,
  isSameMonth,
  parseISO,
  isToday
} from "date-fns"
import { nb } from "date-fns/locale"
import Link from "next/link"

interface Resource {
  id: string
  name: string
  color: string
}

interface Booking {
  id: string
  title: string
  startTime: string
  endTime: string
  resourceId: string
  resourceName: string
  resourcePartName?: string | null
}

interface Props {
  resources: Resource[]
  bookings: Booking[]
  isLoggedIn: boolean
}

type ViewMode = "week" | "month"

export function PublicCalendar({ resources, bookings, isLoggedIn }: Props) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [selectedResource, setSelectedResource] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  const filteredBookings = useMemo(() => {
    if (!selectedResource) return bookings
    return bookings.filter(b => b.resourceId === selectedResource)
  }, [bookings, selectedResource])

  // Week view data
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: 16 }, (_, i) => i + 7)

  // Month view data
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarDays = Array.from({ length: 42 }, (_, i) => addDays(calendarStart, i))

  const getBookingsForDay = (day: Date) => {
    return filteredBookings.filter(booking => 
      isSameDay(parseISO(booking.startTime), day)
    )
  }

  const getResourceColor = (resourceId: string) => {
    return resources.find(r => r.id === resourceId)?.color || '#3b82f6'
  }

  const navigate = (direction: "prev" | "next") => {
    if (viewMode === "week") {
      setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
    } else {
      setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
    }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("prev")}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Forrige"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-semibold text-gray-900 min-w-[220px] text-center text-lg">
            {viewMode === "week" 
              ? `${format(weekStart, "d. MMM", { locale: nb })} - ${format(addDays(weekStart, 6), "d. MMM yyyy", { locale: nb })}`
              : format(currentDate, "MMMM yyyy", { locale: nb })
            }
          </h2>
          <button
            onClick={() => navigate("next")}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Neste"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="ml-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          >
            I dag
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Resource filter */}
          <select
            value={selectedResource || ""}
            onChange={(e) => setSelectedResource(e.target.value || null)}
            className="input max-w-[200px]"
          >
            <option value="">Alle fasiliteter</option>
            {resources.map(resource => (
              <option key={resource.id} value={resource.id}>{resource.name}</option>
            ))}
          </select>

          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                viewMode === "week" ? "bg-white shadow text-gray-900" : "text-gray-600"
              }`}
            >
              <List className="w-4 h-4" />
              Uke
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${
                viewMode === "month" ? "bg-white shadow text-gray-900" : "text-gray-600"
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
              Måned
            </button>
          </div>
        </div>
      </div>

      {/* Week View */}
      {viewMode === "week" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-8 bg-gray-50 border-b border-gray-200">
            <div className="p-3 text-center text-sm font-medium text-gray-500" />
            {weekDays.map((day) => (
              <div 
                key={day.toISOString()} 
                className={`p-3 text-center border-l border-gray-200 ${
                  isToday(day) ? 'bg-blue-50' : ''
                }`}
              >
                <p className="text-xs text-gray-500 uppercase font-medium">
                  {format(day, "EEE", { locale: nb })}
                </p>
                <p className={`text-xl font-bold ${
                  isToday(day) ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {format(day, "d")}
                </p>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="max-h-[650px] overflow-y-auto">
            {hours.map((hour) => (
              <div key={hour} className="grid grid-cols-8 border-b border-gray-100 last:border-b-0">
                <div className="p-2 text-right text-xs text-gray-400 pr-3 font-medium">
                  {hour.toString().padStart(2, "0")}:00
                </div>
                {weekDays.map((day) => {
                  const dayBookings = getBookingsForDay(day).filter(b => {
                    const start = parseISO(b.startTime)
                    const end = parseISO(b.endTime)
                    const startHour = start.getHours()
                    const endHour = end.getHours() + (end.getMinutes() > 0 ? 1 : 0)
                    return hour >= startHour && hour < endHour
                  })
                  
                  const bookingsStartingThisHour = dayBookings.filter(b => {
                    const start = parseISO(b.startTime)
                    return start.getHours() === hour
                  })
                  
                  return (
                    <div 
                      key={`${day.toISOString()}-${hour}`} 
                      className={`relative min-h-[52px] border-l border-gray-100 ${
                        isToday(day) ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      {bookingsStartingThisHour.map((booking) => {
                        const start = parseISO(booking.startTime)
                        const end = parseISO(booking.endTime)
                        const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
                        const top = (start.getMinutes() / 60) * 100
                        const resourceColor = getResourceColor(booking.resourceId)

                        return (
                          <button
                            key={booking.id}
                            onClick={() => setSelectedBooking(booking)}
                            className="absolute left-1 right-1 rounded-lg px-2 py-1.5 text-xs overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:z-10 text-left"
                            style={{
                              top: `${top}%`,
                              height: `${Math.max(duration * 100, 100)}%`,
                              minHeight: '44px',
                              backgroundColor: resourceColor,
                              color: 'white'
                            }}
                          >
                            <p className="font-semibold truncate">{booking.title}</p>
                            <p className="truncate text-[10px] opacity-90">
                              {format(start, "HH:mm")} - {format(end, "HH:mm")}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month View */}
      {viewMode === "month" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((day) => (
              <div key={day} className="p-3 text-center text-sm font-semibold text-gray-600">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const dayBookings = getBookingsForDay(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              
              return (
                <div 
                  key={day.toISOString()}
                  className={`min-h-[110px] p-2 border-b border-r border-gray-100 ${
                    !isCurrentMonth ? 'bg-gray-50/50' : ''
                  } ${isToday(day) ? 'bg-blue-50' : ''} ${
                    i % 7 === 0 ? 'border-l-0' : ''
                  }`}
                >
                  <p className={`text-sm font-semibold mb-2 ${
                    !isCurrentMonth ? 'text-gray-400' : 
                    isToday(day) ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day, "d")}
                  </p>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 3).map((booking) => {
                      const resourceColor = getResourceColor(booking.resourceId)
                      
                      return (
                        <button
                          key={booking.id}
                          onClick={() => setSelectedBooking(booking)}
                          className="w-full text-xs px-2 py-1 rounded truncate text-left hover:opacity-80 transition-opacity"
                          style={{
                            backgroundColor: resourceColor,
                            color: 'white'
                          }}
                        >
                          {format(parseISO(booking.startTime), "HH:mm")} {booking.title}
                        </button>
                      )
                    })}
                    {dayBookings.length > 3 && (
                      <p className="text-xs text-gray-500 px-1 font-medium">
                        +{dayBookings.length - 3} til
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm bg-white p-4 rounded-xl border border-gray-200">
        <span className="text-gray-500 font-medium">Fasiliteter:</span>
        {resources.map((resource) => (
          <button
            key={resource.id}
            onClick={() => setSelectedResource(selectedResource === resource.id ? null : resource.id)}
            className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
              selectedResource === resource.id 
                ? 'bg-gray-100' 
                : 'hover:bg-gray-50'
            }`}
            style={selectedResource === resource.id ? { 
              boxShadow: `0 0 0 2px ${resource.color}`
            } : undefined}
          >
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: resource.color }}
            />
            <span className="text-gray-700">{resource.name}</span>
          </button>
        ))}
      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedBooking(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="p-6 rounded-t-2xl"
              style={{ backgroundColor: getResourceColor(selectedBooking.resourceId) }}
            >
              <p className="text-white/80 text-sm font-medium">
                {selectedBooking.resourceName}
                {selectedBooking.resourcePartName && ` • ${selectedBooking.resourcePartName}`}
              </p>
              <h3 className="text-2xl font-bold text-white mt-1">
                {selectedBooking.title}
              </h3>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar className="w-5 h-5 text-gray-400" />
                <span>
                  {format(parseISO(selectedBooking.startTime), "EEEE d. MMMM yyyy", { locale: nb })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Clock className="w-5 h-5 text-gray-400" />
                <span>
                  {format(parseISO(selectedBooking.startTime), "HH:mm")} - {format(parseISO(selectedBooking.endTime), "HH:mm")}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <MapPin className="w-5 h-5 text-gray-400" />
                <span>
                  {selectedBooking.resourceName}
                  {selectedBooking.resourcePartName && ` (${selectedBooking.resourcePartName})`}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setSelectedBooking(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Lukk
              </button>
              {isLoggedIn ? (
                <Link
                  href={`/resources/${selectedBooking.resourceId}/book`}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                >
                  Book denne fasiliteten
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                >
                  Logg inn for å booke
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

