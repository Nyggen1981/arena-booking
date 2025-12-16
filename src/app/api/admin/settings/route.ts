import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!session.user.organizationId) {
      return NextResponse.json({ error: "Organization ID missing" }, { status: 400 })
    }

    // Try using Prisma first, fallback to raw SQL if it fails
    let org
    try {
      // Use select to avoid relation validation issues
      org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          tagline: true,
          primaryColor: true,
          secondaryColor: true,
          smtpHost: true,
          smtpPort: true,
          smtpUser: true,
          smtpPass: true,
          smtpFrom: true,
          createdAt: true,
          updatedAt: true,
          isActive: true,
          subscriptionEndsAt: true,
          graceEndsAt: true
        }
      })
    } catch (prismaError: any) {
      // If Prisma fails (e.g., due to missing relations), try raw SQL
      console.warn("Prisma query failed, trying raw SQL:", prismaError.message)
      
      try {
        const result = await prisma.$queryRaw<Array<{
          id: string
          name: string
          slug: string
          logo: string | null
          tagline: string
          primaryColor: string
          secondaryColor: string
          smtpHost: string | null
          smtpPort: number | null
          smtpUser: string | null
          smtpPass: string | null
          smtpFrom: string | null
          createdAt: Date
          updatedAt: Date
          isActive: boolean
          subscriptionEndsAt: Date | null
          graceEndsAt: Date | null
        }>>`
          SELECT 
            id, name, slug, logo, tagline, 
            "primaryColor", "secondaryColor",
            "smtpHost", "smtpPort", "smtpUser", "smtpPass", "smtpFrom",
            "createdAt", "updatedAt", "isActive",
            "subscriptionEndsAt", "graceEndsAt"
          FROM "Organization"
          WHERE id = ${session.user.organizationId}
          LIMIT 1
        `
        
        org = result[0] || null
      } catch (sqlError: any) {
        console.error("Raw SQL query also failed:", sqlError.message)
        // Re-throw the original Prisma error, not the SQL error
        throw prismaError
      }
    }

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }

    return NextResponse.json(org)
  } catch (error) {
    // Log detailed error information
    console.error("Error fetching organization settings:", error)
    
    if (error instanceof Error) {
      const errorCode = (error as any)?.code || ""
      console.error("Error details:", {
        message: error.message,
        code: errorCode,
        stack: error.stack,
        name: error.name
      })
      
      // Check for specific Prisma errors
      if (errorCode === "P2021" || errorCode === "P1001") {
        console.error("Database connection or schema error detected")
      }
    } else {
      console.error("Full error object:", JSON.stringify(error, null, 2))
    }
    
    return NextResponse.json(
      { 
        error: "Kunne ikke laste innstillinger",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { 
    name, 
    slug, 
    logo, 
    tagline, 
    primaryColor, 
    secondaryColor,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom
  } = await request.json()

  // Check if slug is already taken by another org
  if (slug) {
    const existing = await prisma.organization.findFirst({
      where: {
        slug,
        NOT: { id: session.user.organizationId }
      }
    })
    if (existing) {
      return NextResponse.json({ error: "Denne klubbkoden er allerede i bruk" }, { status: 400 })
    }
  }

  const updated = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      name,
      slug,
      logo,
      tagline,
      primaryColor,
      secondaryColor,
      smtpHost: smtpHost || null,
      smtpPort: smtpPort ? parseInt(smtpPort) : null,
      smtpUser: smtpUser || null,
      smtpPass: smtpPass || null, // Note: In production, consider encrypting this
      smtpFrom: smtpFrom || null,
    }
  })

  return NextResponse.json(updated)
}

