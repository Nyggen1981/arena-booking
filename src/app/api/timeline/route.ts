import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // GDPR: Only admins and moderators can see user info on bookings
  const canSeeUserInfo = session.user.role === "admin" || session.user.role === "moderator"

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

  const organizationId = session.user.organizationId

  // Get all bookings and resources in parallel for better performance
  const [bookings, resources] = await Promise.all([
    prisma.booking.findMany({
      where: {
        organizationId,
        status: { in: ["approved", "pending"] },
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
      // GDPR: Only include user info for admins/moderators
      ...(canSeeUserInfo ? {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      } : {
        userId: true
      })
    },
      orderBy: { startTime: "asc" }
    }),
    prisma.resource.findMany({
      where: {
        organizationId,
        isActive: true
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
}

