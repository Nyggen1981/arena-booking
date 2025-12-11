import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const resources = await prisma.resource.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        image: true,
        color: true,
        minBookingMinutes: true,
        maxBookingMinutes: true,
        requiresApproval: true,
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        parts: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            description: true,
            capacity: true,
            mapCoordinates: true
            // Excluding adminNote since it doesn't exist in database yet
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json(resources)
  } catch (error) {
    console.error("Error fetching resources:", error)
    return NextResponse.json(
      { error: "Kunne ikke hente fasiliteter" },
      { status: 500 }
    )
  }
}

