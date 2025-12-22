import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/db"
import { isPricingEnabled } from "@/lib/pricing"

// GET - Get available fixed price packages for a resource/part (public endpoint for booking)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if pricing is enabled
    const pricingEnabled = await isPricingEnabled(session.user.organizationId)
    if (!pricingEnabled) {
      return NextResponse.json([])
    }

    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get("resourceId")
    const resourcePartId = searchParams.get("resourcePartId")

    if (!resourceId && !resourcePartId) {
      return NextResponse.json(
        { error: "resourceId or resourcePartId is required" },
        { status: 400 }
      )
    }

    // Fetch active packages only
    const packages = await prisma.fixedPricePackage.findMany({
      where: {
        ...(resourceId && !resourcePartId ? { resourceId, resourcePartId: null } : {}),
        ...(resourcePartId ? { resourcePartId } : {}),
        organizationId: session.user.organizationId,
        isActive: true
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        isActive: true
      }
    })

    return NextResponse.json(packages)
  } catch (error) {
    console.error("Error fetching fixed price packages:", error)
    return NextResponse.json(
      { error: "Failed to fetch fixed price packages" },
      { status: 500 }
    )
  }
}

