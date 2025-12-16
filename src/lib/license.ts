// Lisensvalidering mot sentral lisensserver

export interface LicenseValidationResult {
  valid: boolean
  status: "active" | "grace" | "expired" | "suspended" | "invalid" | "error"
  organization?: string
  expiresAt?: string
  daysRemaining?: number
  limits?: {
    maxUsers: number | null
    maxResources: number | null
  }
  features?: {
    emailNotifications: boolean
    customBranding: boolean
    prioritySupport: boolean
  }
  message?: string
  graceMode?: boolean
  restrictions?: {
    readOnly: boolean
    showWarning: boolean
    canCreateBookings: boolean
    canCreateUsers: boolean
  }
}

// Cache for å unngå for mange API-kall
let cachedResult: LicenseValidationResult | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutter

/**
 * Validerer lisensen mot lisensserveren
 * Cacher resultatet i 5 minutter for å redusere API-kall
 */
export async function validateLicense(forceRefresh = false): Promise<LicenseValidationResult> {
  // Sjekk om vi har miljøvariabler
  const serverUrl = process.env.LICENSE_SERVER_URL
  const licenseKey = process.env.LICENSE_KEY
  const orgSlug = process.env.ORG_SLUG

  // Hvis ingen lisensserver er konfigurert, tillat alt (development mode)
  if (!serverUrl || !licenseKey || !orgSlug) {
    console.log("[License] No license server configured - running in development mode")
    return {
      valid: true,
      status: "active",
      organization: "Development Mode",
      message: "Ingen lisensserver konfigurert"
    }
  }

  // Returner cached resultat hvis det er gyldig
  if (!forceRefresh && cachedResult && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedResult
  }

  try {
    // Hent statistikk fra databasen for å sende med
    const stats = await getLicenseStats()

    const response = await fetch(`${serverUrl}/api/license/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: orgSlug,
        licenseKey: licenseKey,
        appVersion: process.env.npm_package_version || "1.0.15",
        stats
      }),
      // Timeout etter 10 sekunder
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`License server returned ${response.status}`)
    }

    const data = await response.json()
    
    // Cache resultatet
    cachedResult = data
    cacheTimestamp = Date.now()

    console.log(`[License] Validation result: ${data.status} for ${data.organization}`)
    
    return data
  } catch (error) {
    console.error("[License] Validation error:", error)
    
    // Ved feil, bruk cached resultat hvis det finnes (grace ved nettverksfeil)
    if (cachedResult) {
      console.log("[License] Using cached result due to error")
      return cachedResult
    }

    // Hvis ingen cache og feil, returner "error" status men tillat bruk
    // Dette gir en grace period ved nettverksproblemer
    return {
      valid: true, // Tillat bruk ved feil (grace)
      status: "error",
      message: "Kunne ikke kontakte lisensserver. Prøver igjen senere.",
      graceMode: true
    }
  }
}

/**
 * Henter statistikk fra databasen for å rapportere til lisensserveren
 */
async function getLicenseStats(): Promise<{ users: number; bookings: number }> {
  try {
    // Dynamisk import for å unngå sirkulære avhengigheter
    const { prisma } = await import("./prisma")
    
    const [userCount, bookingCount] = await Promise.all([
      prisma.user.count(),
      prisma.booking.count()
    ])

    return {
      users: userCount,
      bookings: bookingCount
    }
  } catch {
    return { users: 0, bookings: 0 }
  }
}

/**
 * Sjekker om en spesifikk funksjon er tilgjengelig basert på lisensen
 */
export async function hasFeature(feature: keyof NonNullable<LicenseValidationResult["features"]>): Promise<boolean> {
  const license = await validateLicense()
  return license.features?.[feature] ?? false
}

/**
 * Sjekker om vi er innenfor brukergrensen
 */
export async function canCreateUser(): Promise<{ allowed: boolean; message?: string }> {
  const license = await validateLicense()
  
  if (!license.valid) {
    return { allowed: false, message: license.message || "Lisensen er ikke gyldig" }
  }

  if (license.restrictions?.canCreateUsers === false) {
    return { allowed: false, message: "Kan ikke opprette nye brukere i grace period" }
  }

  if (license.limits?.maxUsers) {
    const stats = await getLicenseStats()
    if (stats.users >= license.limits.maxUsers) {
      return { 
        allowed: false, 
        message: `Maksimalt antall brukere (${license.limits.maxUsers}) er nådd. Oppgrader lisensen for flere brukere.` 
      }
    }
  }

  return { allowed: true }
}

/**
 * Sjekker om vi er innenfor ressursgrensen
 */
export async function canCreateResource(): Promise<{ allowed: boolean; message?: string }> {
  const license = await validateLicense()
  
  if (!license.valid) {
    return { allowed: false, message: license.message || "Lisensen er ikke gyldig" }
  }

  if (license.limits?.maxResources) {
    try {
      const { prisma } = await import("./prisma")
      const resourceCount = await prisma.resource.count()
      
      if (resourceCount >= license.limits.maxResources) {
        return { 
          allowed: false, 
          message: `Maksimalt antall ressurser (${license.limits.maxResources}) er nådd. Oppgrader lisensen for flere.` 
        }
      }
    } catch {
      // Ved feil, tillat
    }
  }

  return { allowed: true }
}

/**
 * Tømmer cache - bruk når du vil tvinge en ny validering
 */
export function clearLicenseCache(): void {
  cachedResult = null
  cacheTimestamp = 0
}

/**
 * Henter lisensinfo for visning i UI (server-side)
 */
export async function getLicenseInfo(): Promise<{
  status: LicenseValidationResult["status"]
  organization: string
  expiresAt: string | null
  daysRemaining: number | null
  showWarning: boolean
  warningMessage: string | null
  limits: LicenseValidationResult["limits"]
}> {
  const license = await validateLicense()

  let showWarning = false
  let warningMessage: string | null = null

  if (license.status === "grace") {
    showWarning = true
    warningMessage = license.message || `Lisensen har utløpt. ${license.daysRemaining} dager igjen av grace period.`
  } else if (license.status === "expired" || license.status === "suspended") {
    showWarning = true
    warningMessage = license.message || "Lisensen er ikke gyldig. Kontakt administrator."
  } else if (license.daysRemaining && license.daysRemaining <= 14) {
    showWarning = true
    warningMessage = `Lisensen utløper om ${license.daysRemaining} dager.`
  }

  return {
    status: license.status,
    organization: license.organization || "Ukjent",
    expiresAt: license.expiresAt || null,
    daysRemaining: license.daysRemaining ?? null,
    showWarning,
    warningMessage,
    limits: license.limits
  }
}

