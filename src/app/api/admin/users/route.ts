import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      phone: true,
      isApproved: true,
      approvedAt: true,
      createdAt: true,
      _count: {
        select: { bookings: true }
      },
      moderatedResources: {
        select: {
          resource: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: [
      { isApproved: "asc" },
      { role: "asc" },
      { name: "asc" }
    ]
  })

  return NextResponse.json(users)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { email, name, password, role, phone } = await request.json()

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: "E-postadressen er allerede i bruk" }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role: role || "user",
      phone,
      isApproved: true, // Users added by admin are auto-approved
      approvedAt: new Date(),
      organizationId: session.user.organizationId
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  })

  return NextResponse.json(user, { status: 201 })
}

