import { NextResponse } from "next/server"

// TEMPORARILY DISABLED - ResourceModerator feature needs proper database migration
// This file will be restored when the database is properly migrated

export async function GET() {
  return NextResponse.json({ 
    error: "Moderator-funksjonalitet er midlertidig deaktivert",
    message: "Denne funksjonen vil bli aktivert etter at databasen er oppdatert"
  }, { status: 503 })
}

export async function POST() {
  return NextResponse.json({ 
    error: "Moderator-funksjonalitet er midlertidig deaktivert",
    message: "Denne funksjonen vil bli aktivert etter at databasen er oppdatert"
  }, { status: 503 })
}

export async function DELETE() {
  return NextResponse.json({ 
    error: "Moderator-funksjonalitet er midlertidig deaktivert",
    message: "Denne funksjonen vil bli aktivert etter at databasen er oppdatert"
  }, { status: 503 })
}
