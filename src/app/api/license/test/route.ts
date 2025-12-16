import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    // Kun admin kan teste lisens
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { serverUrl, licenseKey, orgSlug } = await req.json()

    if (!serverUrl || !licenseKey || !orgSlug) {
      return NextResponse.json({
        valid: false,
        error: "Alle felt må fylles ut"
      })
    }

    // Kall lisensserveren direkte med de oppgitte verdiene
    const response = await fetch(`${serverUrl}/api/license/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: orgSlug,
        licenseKey: licenseKey,
        appVersion: "1.0.16"
      }),
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      return NextResponse.json({
        valid: false,
        status: "error",
        message: `Lisensserver returnerte feil: ${response.status}`
      })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error("License test error:", error)
    
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({
        valid: false,
        status: "timeout",
        message: "Lisensserveren svarte ikke innen 10 sekunder"
      })
    }

    return NextResponse.json({
      valid: false,
      status: "error",
      message: "Kunne ikke kontakte lisensserveren"
    })
  }
}

