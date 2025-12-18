import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get("date")
  const startDateParam = searchParams.get("startDate")
  const endDateParam = searchParams.get("endDate")
  
  let startOfDay: Date
  let endOfDay: Date
  
  if (startDateParam && endDateParam) {
    // Week or month view
    startOfDay = new Date(startDateParam)
    startOfDay.setHours(0, 0, 0, 0)
    endOfDay = new Date(endDateParam)
    endOfDay.setHours(23, 59, 59, 999)
  } else {
    // Day view (backward compatibility)
    const targetDate = dateParam ? new Date(dateParam) : new Date()
    startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)
  }

  try {
    // Get organization from environment or use first available
    const orgSlug = process.env.PREFERRED_ORG_SLUG
    let organization = null

    if (orgSlug) {
      organization = await prisma.organization.findFirst({
        where: { slug: orgSlug }
      })
    }

    if (!organization) {
      organization = await prisma.organization.findFirst()
    }

    if (!organization) {
      return NextResponse.json({
        bookings: [],
        resources: [],
        date: startOfDay.toISOString()
      })
    }

    // Get all bookings and resources in parallel for better performance
    // Only show approved bookings (no pending) and only resources with showOnPublicCalendar = true
    const [bookings, resources] = await Promise.all([
      prisma.booking.findMany({
        where: {
          organizationId: organization.id,
          status: "approved", // Only approved bookings for public calendar
          OR: [
            {
              // Bookings that start on this day
              startTime: { gte: startOfDay, lte: endOfDay }
            },
            {
              // Bookings that end on this day
              endTime: { gte: startOfDay, lte: endOfDay }
            },
            {
              // Bookings that span this day
              AND: [
                { startTime: { lte: startOfDay } },
                { endTime: { gte: endOfDay } }
              ]
            }
          ]
        },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          status: true,
          userId: true,
          isRecurring: true,
          resource: {
            select: {
              id: true,
              name: true,
              color: true,
              allowWholeBooking: true,
              category: {
                select: {
                  id: true,
                  name: true,
                  color: true
                }
              },
              parts: {
                where: { isActive: true },
                select: {
                  id: true,
                  name: true
                },
                orderBy: { name: "asc" }
              }
            }
          },
          resourcePart: {
            select: {
              id: true,
              name: true,
              parentId: true
            }
          },
          // GDPR: Only include userId for public API (to check if booking is own)
          // Name and email are hidden from public view
          userId: true
        },
        orderBy: { startTime: "asc" }
      }),
      prisma.resource.findMany({
        where: {
          organizationId: organization.id,
          isActive: true,
          showOnPublicCalendar: true // Only resources that should be shown on public calendar
        },
        select: {
          id: true,
          name: true,
          color: true,
          allowWholeBooking: true,
          category: {
            select: {
              id: true,
              name: true,
              color: true
            }
          },
          parts: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              parentId: true,
              children: {
                where: { isActive: true },
                select: { id: true, name: true }
              }
            },
            orderBy: { name: "asc" }
          }
        },
        orderBy: [
          { category: { name: "asc" } },
          { name: "asc" }
        ]
      })
    ])

    return NextResponse.json({
      bookings,
      resources,
      date: startOfDay.toISOString()
    })
  } catch (error) {
    console.error("Error fetching public timeline data:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente kalenderdata" },
      { status: 500 }
    )
  }
}

