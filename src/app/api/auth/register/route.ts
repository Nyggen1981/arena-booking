import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const { name, email, phone, password, orgSlug } = await request.json()

    // Validate required fields
    if (!email || !password || !orgSlug) {
      return NextResponse.json(
        { error: "E-post, passord og klubbkode er påkrevd" },
        { status: 400 }
      )
    }

    // Check if email already exists - use raw SQL as fallback
    let existingUser
    try {
      existingUser = await prisma.user.findUnique({ 
        where: { email },
        select: { id: true }
      })
    } catch (prismaError: any) {
      // Fallback to raw SQL if Prisma fails
      console.warn("Prisma user check failed, trying raw SQL:", prismaError.message)
      const result = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "User" WHERE email = ${email} LIMIT 1
      `
      existingUser = result[0] || null
    }
    
    if (existingUser) {
      return NextResponse.json(
        { error: "E-postadressen er allerede registrert" },
        { status: 400 }
      )
    }

    // Find organization by slug - use raw SQL as fallback
    let organization
    try {
      organization = await prisma.organization.findUnique({ 
        where: { slug: orgSlug },
        select: {
          id: true,
          name: true
        }
      })
    } catch (prismaError: any) {
      // Fallback to raw SQL if Prisma fails
      console.warn("Prisma organization check failed, trying raw SQL:", prismaError.message)
      const result = await prisma.$queryRaw<Array<{ id: string; name: string }>>`
        SELECT id, name FROM "Organization" WHERE slug = ${orgSlug} LIMIT 1
      `
      organization = result[0] || null
    }
    
    if (!organization) {
      return NextResponse.json(
        { error: "Fant ingen klubb med denne koden. Sjekk at du har skrevet riktig." },
        { status: 404 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user - use raw SQL as fallback if Prisma fails
    let user
    try {
      user = await prisma.user.create({
        data: {
          email,
          name,
          phone,
          password: hashedPassword,
          role: "user",
          organizationId: organization.id
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      })
    } catch (prismaError: any) {
      // Fallback to raw SQL if Prisma fails (e.g., due to missing ResourceModerator relation)
      console.warn("Prisma user create failed, trying raw SQL:", prismaError.message)
      
      // Generate cuid-like ID (Prisma uses cuid format)
      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substring(2, 11)
      const userId = `cl${timestamp}${random}`
      
      await prisma.$executeRaw`
        INSERT INTO "User" (id, email, name, phone, password, role, "organizationId", "isApproved", "createdAt", "updatedAt")
        VALUES (
          ${userId},
          ${email},
          ${name || null},
          ${phone || null},
          ${hashedPassword},
          'user',
          ${organization.id},
          false,
          NOW(),
          NOW()
        )
      `
      
      user = {
        id: userId,
        email,
        name: name || null,
        role: "user"
      }
    }

    return NextResponse.json({
      success: true,
      user,
      message: `Velkommen til ${organization.name}!`
    }, { status: 201 })

  } catch (error) {
    // Log full error details for debugging
    console.error("Registration error:", error)
    
    if (error instanceof Error) {
      const errorMessage = error.message || ""
      const errorCode = (error as any)?.code || ""
      
      console.error("Registration error details:", {
        message: errorMessage,
        code: errorCode,
        stack: error.stack,
        name: error.name
      })
      
      // Check for Prisma unique constraint errors
      if (errorCode === "P2002" || errorMessage.includes("Unique constraint")) {
        if (errorMessage.includes("email")) {
          return NextResponse.json(
            { error: "E-postadressen er allerede registrert" },
            { status: 400 }
          )
        }
      }
      
      // Check for database connection errors
      if (errorCode === "P1001" || errorMessage.includes("connect") || errorMessage.includes("timeout") || errorMessage.includes("Can't reach database") || errorMessage.includes("ECONNREFUSED")) {
        return NextResponse.json(
          { error: "Kunne ikke koble til database. Prøv igjen om litt." },
          { status: 503 }
        )
      }
      
      // Check for Prisma schema errors (migration needed)
      if (errorCode === "P2021" || errorCode === "P1001" || errorMessage.includes("Unknown arg") || errorMessage.includes("does not exist") || (errorMessage.includes("table") && errorMessage.includes("does not exist"))) {
        console.error("Schema error detected - likely missing ResourceModerator table")
        return NextResponse.json(
          { error: "Database-skjemaet er ikke oppdatert. Kontakt administrator." },
          { status: 500 }
        )
      }
      
      // Check for foreign key constraint errors
      if (errorCode === "P2003" || errorMessage.includes("Foreign key constraint")) {
        return NextResponse.json(
          { error: "Klubbkoden er ugyldig. Sjekk at du har skrevet riktig kode." },
          { status: 400 }
        )
      }
      
      // Check for relation errors (missing table)
      if (errorCode === "P2017" || errorMessage.includes("relation") || errorMessage.includes("ResourceModerator")) {
        console.error("Relation error detected - ResourceModerator table may be missing")
        return NextResponse.json(
          { error: "Database-skjemaet er ikke oppdatert. Kontakt administrator." },
          { status: 500 }
        )
      }
    } else {
      console.error("Full registration error (non-Error object):", JSON.stringify(error, null, 2))
    }
    
    return NextResponse.json(
      { error: "Kunne ikke opprette bruker. Prøv igjen." },
      { status: 500 }
    )
  }
}

