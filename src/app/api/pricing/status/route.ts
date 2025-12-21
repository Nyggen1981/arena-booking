import { NextResponse } from "next/server"
import { isPricingEnabled } from "@/lib/pricing"
import { validateLicense } from "@/lib/license"

export async function GET(request: Request) {
  try {
    // Sjekk om forceRefresh er satt i query params
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get("forceRefresh") === "true"
    
    const enabled = await isPricingEnabled(forceRefresh)
    return NextResponse.json({ enabled })
  } catch (error) {
    console.error("Error checking pricing status:", error)
    return NextResponse.json({ enabled: false })
  }
}

