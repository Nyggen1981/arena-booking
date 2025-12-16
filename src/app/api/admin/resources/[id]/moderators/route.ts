import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET - Get all moderators for a resource
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Verify resource belongs to organization
  const resource = await prisma.resource.findUnique({
    where: { id },
    select: { organizationId: true }
  })

  if (!resource || resource.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }

  const moderators = await prisma.resourceModerator.findMany({
    where: { resourceId: id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  })

  return NextResponse.json(moderators)
}

// POST - Add a moderator to a resource
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { userId } = await request.json()

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  // Verify resource belongs to organization
  const resource = await prisma.resource.findUnique({
    where: { id },
    select: { organizationId: true }
  })

  if (!resource || resource.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }

  // Verify user exists and belongs to same organization
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, role: true }
  })

  if (!user || user.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // User must have moderator role
  if (user.role !== "moderator") {
    return NextResponse.json(
      { error: "Brukeren må ha moderator-rolle for å kunne moderere fasiliteter" },
      { status: 400 }
    )
  }

  // Check if already a moderator for this resource
  const existing = await prisma.resourceModerator.findUnique({
    where: {
      userId_resourceId: {
        userId,
        resourceId: id
      }
    }
  })

  if (existing) {
    return NextResponse.json(
      { error: "Brukeren er allerede moderator for denne fasiliteten" },
      { status: 400 }
    )
  }

  // Create moderator relationship
  const moderator = await prisma.resourceModerator.create({
    data: {
      userId,
      resourceId: id
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  })

  return NextResponse.json(moderator, { status: 201 })
}

// DELETE - Remove a moderator from a resource
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get("userId")

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  // Verify resource belongs to organization
  const resource = await prisma.resource.findUnique({
    where: { id },
    select: { organizationId: true }
  })

  if (!resource || resource.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }

  // Delete moderator relationship
  await prisma.resourceModerator.delete({
    where: {
      userId_resourceId: {
        userId,
        resourceId: id
      }
    }
  })

  return NextResponse.json({ success: true })
}

