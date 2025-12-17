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
          name: true,
          parentId: true
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
    }),
    prisma.resource.findMany({
      where: {
        organizationId,
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
    date: targetDate.toISOString()
  })
}

