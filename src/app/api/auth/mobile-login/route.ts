import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-post og passord er påkrevd" },
        { status: 400 }
      )
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        organization: true,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Ugyldig e-post eller passord" },
        { status: 401 }
      )
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password)

    if (!isValid) {
      return NextResponse.json(
        { error: "Ugyldig e-post eller passord" },
        { status: 401 }
      )
    }

    // Return user data (exclude password)
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json({
      user: userWithoutPassword,
      message: "Innlogging vellykket",
    })
  } catch (error) {
    console.error("Mobile login error:", error)
    return NextResponse.json(
      { error: "Noe gikk galt" },
      { status: 500 }
    )
  }
}

