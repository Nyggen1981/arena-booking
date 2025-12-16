import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ count: 0 })
  }

  const isAdmin = session.user.role === "admin"
  const isModerator = session.user.role === "moderator"

  if (!isAdmin && !isModerator) {
    return NextResponse.json({ count: 0 })
  }

  // NOTE: ResourceModerator temporarily disabled - moderators see all pending bookings for now

  const count = await prisma.booking.count({
    where: {
      status: "pending",
      resource: {
        organizationId: session.user.organizationId
      }
    }
  })

  return NextResponse.json({ count })
}





