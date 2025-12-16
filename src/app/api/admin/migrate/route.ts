import { NextResponse } from "next/server"

// TEMPORARILY DISABLED - Migration endpoint not needed since ResourceModerator is disabled
// This file will be restored when the database migration feature is needed

export async function GET() {
  return NextResponse.json({ 
    exists: true, // Pretend it exists to hide the migration UI
    message: "ResourceModerator feature is temporarily disabled"
  })
}

export async function POST() {
  return NextResponse.json({ 
    success: true,
    message: "Migration not needed - feature is temporarily disabled"
  })
}
