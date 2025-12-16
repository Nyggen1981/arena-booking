import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// POST - Run database migration to create ResourceModerator table
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Check if ResourceModerator table already exists
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ResourceModerator'
      ) as exists;
    `

    if (tableExists[0]?.exists) {
      return NextResponse.json({
        success: true,
        message: "ResourceModerator-tabellen eksisterer allerede"
      })
    }

    // Create ResourceModerator table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ResourceModerator" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "resourceId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ResourceModerator_pkey" PRIMARY KEY ("id")
      );
    `

    // Create unique constraint
    await prisma.$executeRaw`
      CREATE UNIQUE INDEX IF NOT EXISTS "ResourceModerator_userId_resourceId_key" 
      ON "ResourceModerator"("userId", "resourceId");
    `

    // Create indexes
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ResourceModerator_userId_idx" 
      ON "ResourceModerator"("userId");
    `

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ResourceModerator_resourceId_idx" 
      ON "ResourceModerator"("resourceId");
    `

    // Add foreign key constraints (with error handling if they already exist)
    try {
      await prisma.$executeRaw`
        ALTER TABLE "ResourceModerator" 
        ADD CONSTRAINT "ResourceModerator_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `
    } catch (error: any) {
      // Constraint might already exist, that's OK
      if (!error.message?.includes("already exists") && !error.message?.includes("duplicate")) {
        throw error
      }
    }

    try {
      await prisma.$executeRaw`
        ALTER TABLE "ResourceModerator" 
        ADD CONSTRAINT "ResourceModerator_resourceId_fkey" 
        FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `
    } catch (error: any) {
      // Constraint might already exist, that's OK
      if (!error.message?.includes("already exists") && !error.message?.includes("duplicate")) {
        throw error
      }
    }

    return NextResponse.json({
      success: true,
      message: "ResourceModerator-tabellen er opprettet!"
    })
  } catch (error) {
    console.error("Migration error:", error)
    return NextResponse.json(
      { 
        error: "Kunne ikke opprette tabell. Se server logs for detaljer.",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

// GET - Check if ResourceModerator table exists
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Try to query the table - if it doesn't exist, Prisma will throw an error
    // This is safer than using raw SQL which might fail if there are permission issues
    try {
      await prisma.$queryRaw`SELECT 1 FROM "ResourceModerator" LIMIT 1`
      return NextResponse.json({ exists: true })
    } catch (error: any) {
      // If error is about table not existing, return false
      if (error?.message?.includes("does not exist") || 
          error?.message?.includes("relation") ||
          error?.code === "P2021") {
        return NextResponse.json({ exists: false })
      }
      // Otherwise, re-throw the error
      throw error
    }
  } catch (error) {
    console.error("Check migration error:", error)
    // Return exists: null to indicate we couldn't check (non-critical)
    return NextResponse.json({ exists: null })
  }
}

