import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"

  if (!isAdmin && !isModerator) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  // If moderator, get list of resource IDs they can moderate
  let resourceIds: string[] | undefined
  if (isModerator) {
    const moderatorResources = await prisma.resourceModerator.findMany({
      where: { userId: session.user.id },
      select: { resourceId: true }
    })
    resourceIds = moderatorResources.map(mr => mr.resourceId)
    
    // If moderator has no resources, return empty array
    if (resourceIds.length === 0) {
      return NextResponse.json([])
    }
  }

  const bookings = await prisma.booking.findMany({
    where: {
      organizationId: session.user.organizationId,
      ...(status === "pending" ? { status: "pending" } : {}),
      ...(isModerator && resourceIds ? { resourceId: { in: resourceIds } } : {})
    },
    include: {
      resource: true,
      resourcePart: true,
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

