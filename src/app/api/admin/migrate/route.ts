import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// Check if ResourceModerator table exists
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if table exists by trying to query it
    try {
      await prisma.$queryRaw`SELECT 1 FROM "ResourceModerator" LIMIT 1`
      return NextResponse.json({ exists: true })
    } catch {
      return NextResponse.json({ exists: false })
    }
  } catch (error) {
    console.error("Migration check error:", error)
    return NextResponse.json({ exists: false, error: "Could not check table status" })
  }
}

// Create ResourceModerator table
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if table already exists
    try {
      await prisma.$queryRaw`SELECT 1 FROM "ResourceModerator" LIMIT 1`
      return NextResponse.json({ 
        success: true, 
        message: "Tabellen eksisterer allerede" 
      })
    } catch {
      // Table doesn't exist, create it
    }

    // Create the ResourceModerator table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ResourceModerator" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "resourceId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "ResourceModerator_pkey" PRIMARY KEY ("id")
      )
    `

    // Create unique constraint
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "ResourceModerator_userId_resourceId_key" 
      ON "ResourceModerator"("userId", "resourceId")
    `

    // Create indexes
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ResourceModerator_userId_idx" 
      ON "ResourceModerator"("userId")
    `

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ResourceModerator_resourceId_idx" 
      ON "ResourceModerator"("resourceId")
    `

    // Add foreign key constraints
    await prisma.$executeRaw`
      ALTER TABLE "ResourceModerator" 
      ADD CONSTRAINT "ResourceModerator_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `

    await prisma.$executeRaw`
      ALTER TABLE "ResourceModerator" 
      ADD CONSTRAINT "ResourceModerator_resourceId_fkey" 
      FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `

    return NextResponse.json({ 
      success: true, 
      message: "ResourceModerator-tabellen ble opprettet!" 
    })

  } catch (error: any) {
    console.error("Migration error:", error)
    return NextResponse.json({ 
      success: false, 
      error: error.message || "Kunne ikke opprette tabell" 
    }, { status: 500 })
  }
}
