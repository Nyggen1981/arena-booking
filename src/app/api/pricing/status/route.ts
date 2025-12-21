import { NextResponse } from "next/server"
import { isPricingEnabled } from "@/lib/pricing"

export async function GET() {
  try {
    const enabled = await isPricingEnabled()
    return NextResponse.json({ enabled })
  } catch (error) {
    console.error("Error checking pricing status:", error)
    return NextResponse.json({ enabled: false })
  }
}
