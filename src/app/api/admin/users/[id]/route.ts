import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { role, name, phone, isApproved } = await request.json()

  const user = await prisma.user.findUnique({ where: { id } })

  if (!user || user.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Prevent changing own role
  if (id === session.user.id && role && role !== session.user.role) {
    return NextResponse.json({ error: "Kan ikke endre egen rolle" }, { status: 400 })
  }

  // Build update data
  const updateData: {
    role?: string
    name?: string
    phone?: string
    isApproved?: boolean
    approvedAt?: Date | null
  } = {}

  if (role !== undefined) updateData.role = role
  if (name !== undefined) updateData.name = name
  if (phone !== undefined) updateData.phone = phone
  if (isApproved !== undefined) {
    updateData.isApproved = isApproved
    updateData.approvedAt = isApproved ? new Date() : null
  }

  // If changing role from moderator to user, remove all resource assignments
  if (role === "user" && user.role === "moderator") {
    await prisma.resourceModerator.deleteMany({
      where: { userId: id }
    })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isApproved: true
    }
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // Prevent self-deletion
  if (id === session.user.id) {
    return NextResponse.json({ error: "Kan ikke slette egen bruker" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id } })

  if (!user || user.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ success: true })
}

