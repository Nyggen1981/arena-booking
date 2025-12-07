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
    return NextResponse.json(
      { error: "Kunne ikke opprette bruker. Prøv igjen." },
      { status: 500 }
    )
  }
}

