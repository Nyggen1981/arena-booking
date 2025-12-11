import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  const bookings = await prisma.booking.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...(status === "pending" ? { status: "pending" } : {})
    },
    select: {
      id: true,
      title: true,
      description: true,
      startTime: true,
      endTime: true,
      status: true,
      statusNote: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      isRecurring: true,
      parentBookingId: true,
      createdAt: true,
      updatedAt: true,
      approvedAt: true,
      resourceId: true,
      resourcePartId: true,
      userId: true,
      resource: {
        select: {
          id: true,
          name: true,
          description: true,
          location: true,
          image: true,
          color: true,
          categoryId: true
        }
      },
      resourcePart: {
        select: {
          id: true,
          name: true
          // Excluding adminNote since it doesn't exist in database yet
        }
      },
      user: {
        select: { name: true, email: true }
      }
    },
    orderBy: [
      { status: "asc" },
      { startTime: "asc" }
    ]
  })

  return NextResponse.json(bookings)
}

