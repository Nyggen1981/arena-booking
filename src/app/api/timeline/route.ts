import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get("date")
  
  // Default to today, or use provided date
  const targetDate = dateParam ? new Date(dateParam) : new Date()
  const startOfDay = new Date(targetDate)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(targetDate)
  endOfDay.setHours(23, 59, 59, 999)

  // Get all bookings for the organization on this date
  const bookings = await prisma.booking.findMany({
    where: {
      organizationId: session.user.organizationId,
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
    include: {
      resource: {
        select: {
          id: true,
          name: true,
          color: true,
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
          name: true
        }
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: { startTime: "asc" }
  })

  // Get all resources with their parts for the organization
  const resources = await prisma.resource.findMany({
    where: {
      organizationId: session.user.organizationId,
      isActive: true
    },
    include: {
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
    },
    orderBy: [
      { category: { name: "asc" } },
      { name: "asc" }
    ]
  })

  return NextResponse.json({
    bookings,
    resources,
    date: targetDate.toISOString()
  })
}

