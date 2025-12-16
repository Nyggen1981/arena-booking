import { PageLayout } from "@/components/PageLayout"
import { prisma } from "@/lib/prisma"
import { CalendarView } from "@/components/CalendarView"
import { CalendarHelpBanner } from "@/components/CalendarHelpBanner"
import { unstable_cache } from "next/cache"
import { redirect } from "next/navigation"

// Revalidate every 30 seconds
export const revalidate = 30

// Cache categories for 60 seconds
const getCategories = unstable_cache(
  async () => {
    try {
      return await prisma.resourceCategory.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          color: true
        }
      })
    } catch {
      return []
    }
  },
  ["calendar-categories"],
  { revalidate: 60 }
)

// Cache resources for 60 seconds
const getResources = unstable_cache(
  async () => {
    try {
      return await prisma.resource.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          categoryId: true,
          category: {
            select: { 
              id: true,
              name: true,
              color: true 
            }
          },
          parts: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    } catch {
      return []
    }
  },
  ["calendar-resources"],
  { revalidate: 60 }
)

// Cache bookings for 30 seconds (time-sensitive)
const getBookings = unstable_cache(
  async () => {
    try {
      const now = new Date()
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      const twoMonthsAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

      return await prisma.booking.findMany({
        where: {
          status: { in: ["approved", "pending"] },
          startTime: { gte: twoWeeksAgo, lte: twoMonthsAhead }
        },
        include: {
          resource: true,
          resourcePart: true
        },
        orderBy: { startTime: "asc" }
      })
    } catch {
      return []
    }
  },
  ["calendar-bookings"],
  { revalidate: 30 }
)

export default async function CalendarPage() {
  const [categories, resources, bookings] = await Promise.all([
    getCategories(),
    getResources(),
    getBookings()
  ])

  // If no resources, show empty state instead of redirecting (to avoid redirect loops)
  if (resources.length === 0) {
    return (
      <PageLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen fasiliteter ennå</h2>
          <p className="text-gray-500">Det er ingen fasiliteter tilgjengelige for kalendervisning.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Kalender</h1>
        <p className="text-gray-500 mb-6">Oversikt over alle bookinger på tvers av fasiliteter</p>

        <CalendarHelpBanner />

        <CalendarView 
          categories={categories.map(c => ({
            id: c.id,
            name: c.name,
            color: c.color
          }))}
          resources={resources.map(r => ({
            id: r.id,
            name: r.name,
            color: r.color || r.category?.color || '#3b82f6',
            categoryId: r.categoryId,
            categoryName: r.category?.name,
            parts: r.parts.map(p => ({ id: p.id, name: p.name }))
          }))}
          bookings={bookings.map(b => ({
            id: b.id,
            title: b.title,
            startTime: (b.startTime instanceof Date ? b.startTime : new Date(b.startTime)).toISOString(),
            endTime: (b.endTime instanceof Date ? b.endTime : new Date(b.endTime)).toISOString(),
            status: b.status,
            resourceId: b.resourceId,
            resourceName: b.resource.name,
            resourcePartName: b.resourcePart?.name,
            isRecurring: b.isRecurring,
            parentBookingId: b.parentBookingId,
            userId: b.userId
          }))}
        />
      </div>
    </PageLayout>
  )
}

