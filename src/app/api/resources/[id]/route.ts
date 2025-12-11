import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const resource = await prisma.resource.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      location: true,
      image: true,
      mapImage: true,
      color: true,
      isActive: true,
      showOnPublicCalendar: true,
      blockPartsWhenWholeBooked: true,
      blockWholeWhenPartBooked: true,
      allowWholeBooking: true,
      minBookingMinutes: true,
      maxBookingMinutes: true,
      requiresApproval: true,
      advanceBookingDays: true,
      openingHours: true,
      prisInfo: true,
      visPrisInfo: true,
      createdAt: true,
      updatedAt: true,
      organizationId: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          description: true,
          icon: true,
          color: true
        }
      },
      parts: {
        select: {
          id: true,
          name: true,
          description: true,
          capacity: true,
          isActive: true,
          mapCoordinates: true,
          parentId: true,
          resourceId: true
          // Excluding adminNote since it doesn't exist in database yet
        },
        orderBy: { name: "asc" }
      }
    }
  })

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }

  return NextResponse.json(resource)
}

