import { NextResponse } from "next/server"
import { getLicenseInfo } from "@/lib/license"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { validateLicense } from "@/lib/license"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    // Kun innloggede brukere kan se lisensstatus
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ showWarning: false })
    }

    // Sjekk om forceRefresh er satt i query params
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get("forceRefresh") === "true"
    
    // Hvis forceRefresh, tving en ny validering først
    if (forceRefresh) {
      await validateLicense(true)
    }

    const licenseInfo = await getLicenseInfo()
    
    return NextResponse.json(licenseInfo)
  } catch (error) {
    console.error("Error getting license status:", error)
    return NextResponse.json({ showWarning: false })
  }
}


