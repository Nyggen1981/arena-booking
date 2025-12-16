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

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: "E-postadressen er allerede registrert" },
        { status: 400 }
      )
    }

    // Find organization by slug
    const organization = await prisma.organization.findUnique({ 
      where: { slug: orgSlug } 
    })
    if (!organization) {
      return NextResponse.json(
        { error: "Fant ingen klubb med denne koden. Sjekk at du har skrevet riktig." },
        { status: 404 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
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

    return NextResponse.json({
      success: true,
      user,
      message: `Velkommen til ${organization.name}!`
    }, { status: 201 })

  } catch (error) {
    console.error("Registration error:", error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      const errorMessage = error.message || ""
      
      // Check for Prisma unique constraint errors
      if (errorMessage.includes("Unique constraint") || errorMessage.includes("P2002")) {
        if (errorMessage.includes("email")) {
          return NextResponse.json(
            { error: "E-postadressen er allerede registrert" },
            { status: 400 }
          )
        }
      }
      
      // Check for database connection errors
      if (errorMessage.includes("connect") || errorMessage.includes("timeout") || errorMessage.includes("Can't reach database") || errorMessage.includes("ECONNREFUSED")) {
        return NextResponse.json(
          { error: "Kunne ikke koble til database. Prøv igjen om litt." },
          { status: 503 }
        )
      }
      
      // Check for Prisma schema errors (migration needed)
      if (errorMessage.includes("Unknown arg") || errorMessage.includes("does not exist") || errorMessage.includes("P2021") || errorMessage.includes("P1001") || errorMessage.includes("table") && errorMessage.includes("does not exist")) {
        return NextResponse.json(
          { error: "Database-skjemaet er ikke oppdatert. Kontakt administrator." },
          { status: 500 }
        )
      }
      
      // Check for foreign key constraint errors
      if (errorMessage.includes("Foreign key constraint") || errorMessage.includes("P2003")) {
        return NextResponse.json(
          { error: "Klubbkoden er ugyldig. Sjekk at du har skrevet riktig kode." },
          { status: 400 }
        )
      }
      
      // Return the actual error message if it's user-friendly
      if (errorMessage && !errorMessage.includes("Prisma") && !errorMessage.includes("P") && !errorMessage.includes("Error:")) {
        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        )
      }
    }
    
    // Log full error for debugging (including stack trace)
    if (error instanceof Error) {
      console.error("Registration error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      })
    } else {
      console.error("Full registration error:", JSON.stringify(error, null, 2))
    }
    
    return NextResponse.json(
      { error: "Kunne ikke opprette bruker. Prøv igjen." },
      { status: 500 }
    )
  }
}

