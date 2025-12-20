import { prisma } from "./prisma"
import { validateLicense } from "./license"
import { getUserRoleInfo } from "./roles"

export type PricingModel = "FREE" | "HOURLY" | "DAILY" | "FIXED" | "FIXED_DURATION"

export interface PricingConfig {
  model: PricingModel
  pricePerHour?: number | null
  pricePerDay?: number | null
  fixedPrice?: number | null
  fixedPriceDuration?: number | null // minutter
  freeForRoles?: string[] // Array av role IDs eller "admin", "user"
}

export interface BookingPriceCalculation {
  price: number
  isFree: boolean
  reason?: string // Hvorfor det er gratis (f.eks. "Gratis for admin", "Gratis for Trener")
  pricingModel: PricingModel
  breakdown?: {
    basePrice: number
    hours?: number
    days?: number
    duration?: number // minutter
  }
}

/**
 * Sjekker om prislogikk er aktivert basert på lisensserver-status
 * Prislogikk er kun aktiv hvis lisensen har "pricing" feature aktivert
 */
export async function isPricingEnabled(): Promise<boolean> {
  try {
    const license = await validateLicense()
    
    // Prislogikk er aktiv hvis:
    // 1. Lisensen er gyldig (active, grace, eller error med grace)
    // 2. Lisensen har pricing-feature aktivert (sjekkes via licenseType eller features)
    
    if (!license.valid && license.status !== "grace" && license.status !== "error") {
      return false
    }
    
    // Sjekk om lisensen har pricing-feature
    // Pilot, premium og standard lisenser har tilgang til prislogikk
    const hasPricingFeature = 
      license.licenseType === "premium" || 
      license.licenseType === "standard" ||
      license.licenseType === "pilot" ||
      license.features?.emailNotifications === true // Bruker eksisterende feature som indikator
    
    return hasPricingFeature
  } catch (error) {
    console.error("[Pricing] Error checking license:", error)
    // Ved feil, returner false for å være på den sikre siden
    return false
  }
}

/**
 * Henter pris-konfigurasjon for en ressurs eller ressursdel
 */
export async function getPricingConfig(
  resourceId: string,
  resourcePartId?: string | null
): Promise<PricingConfig | null> {
  // Sjekk om prising er aktivert
  const pricingEnabled = await isPricingEnabled()
  if (!pricingEnabled) {
    return null // Prislogikk er ikke aktivert
  }

  try {
    if (resourcePartId) {
      // Hent pris fra ressursdel (overstyrer ressurs hvis satt)
      const part = await prisma.resourcePart.findUnique({
        where: { id: resourcePartId },
        select: {
          pricingModel: true,
          pricePerHour: true,
          pricePerDay: true,
          fixedPrice: true,
          fixedPriceDuration: true,
          freeForRoles: true,
          resource: {
            select: {
              pricingModel: true,
              pricePerHour: true,
              pricePerDay: true,
              fixedPrice: true,
              fixedPriceDuration: true,
              freeForRoles: true
            }
          }
        }
      })

      if (!part) return null

      // Bruk part-pris hvis satt, ellers fallback til resource
      return {
        model: (part.pricingModel || part.resource.pricingModel || "FREE") as PricingModel,
        pricePerHour: part.pricePerHour ? Number(part.pricePerHour) : (part.resource.pricePerHour ? Number(part.resource.pricePerHour) : null),
        pricePerDay: part.pricePerDay ? Number(part.pricePerDay) : (part.resource.pricePerDay ? Number(part.resource.pricePerDay) : null),
        fixedPrice: part.fixedPrice ? Number(part.fixedPrice) : (part.resource.fixedPrice ? Number(part.resource.fixedPrice) : null),
        fixedPriceDuration: part.fixedPriceDuration ?? part.resource.fixedPriceDuration ?? null,
        freeForRoles: part.freeForRoles 
          ? JSON.parse(part.freeForRoles) 
          : (part.resource.freeForRoles ? JSON.parse(part.resource.freeForRoles) : [])
      }
    } else {
      // Hent pris fra ressurs
      const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        select: {
          pricingModel: true,
          pricePerHour: true,
          pricePerDay: true,
          fixedPrice: true,
          fixedPriceDuration: true,
          freeForRoles: true
        }
      })

      if (!resource) return null

      return {
        model: (resource.pricingModel || "FREE") as PricingModel,
        pricePerHour: resource.pricePerHour ? Number(resource.pricePerHour) : null,
        pricePerDay: resource.pricePerDay ? Number(resource.pricePerDay) : null,
        fixedPrice: resource.fixedPrice ? Number(resource.fixedPrice) : null,
        fixedPriceDuration: resource.fixedPriceDuration ?? null,
        freeForRoles: resource.freeForRoles ? JSON.parse(resource.freeForRoles) : []
      }
    }
  } catch (error) {
    console.error("[Pricing] Error getting pricing config:", error)
    return null
  }
}

/**
 * Sjekker om en bruker har gratis tilgang basert på rolle
 */
async function isFreeForUser(
  userId: string,
  freeForRoles: string[]
): Promise<{ isFree: boolean; reason?: string }> {
  if (freeForRoles.length === 0) {
    return { isFree: false }
  }

  try {
    const roleInfo = await getUserRoleInfo(userId)
    
    // Sjekk om brukeren er admin
    if (roleInfo.isAdmin && freeForRoles.includes("admin")) {
      return { isFree: true, reason: "Gratis for administrator" }
    }
    
    // Sjekk om brukeren har en custom role som er i listen
    if (roleInfo.customRole && freeForRoles.includes(roleInfo.customRole.id)) {
      return { isFree: true, reason: `Gratis for ${roleInfo.customRole.name}` }
    }
    
    // Sjekk om systemRole "user" er i listen
    if (roleInfo.systemRole === "user" && freeForRoles.includes("user")) {
      return { isFree: true, reason: "Gratis for brukere" }
    }
    
    return { isFree: false }
  } catch (error) {
    console.error("[Pricing] Error checking user role:", error)
    return { isFree: false }
  }
}

/**
 * Beregner pris for en booking
 */
export async function calculateBookingPrice(
  userId: string,
  resourceId: string,
  resourcePartId: string | null,
  startTime: Date,
  endTime: Date
): Promise<BookingPriceCalculation> {
  // Sjekk om prising er aktivert
  const pricingEnabled = await isPricingEnabled()
  if (!pricingEnabled) {
    return {
      price: 0,
      isFree: true,
      reason: "Prislogikk er ikke aktivert",
      pricingModel: "FREE"
    }
  }

  const config = await getPricingConfig(resourceId, resourcePartId)
  
  if (!config || config.model === "FREE") {
    return {
      price: 0,
      isFree: true,
      reason: "Gratis booking",
      pricingModel: "FREE"
    }
  }

  // Sjekk om brukeren har gratis tilgang
  const freeCheck = await isFreeForUser(userId, config.freeForRoles || [])
  if (freeCheck.isFree) {
    return {
      price: 0,
      isFree: true,
      reason: freeCheck.reason,
      pricingModel: config.model
    }
  }

  // Beregn varighet
  const durationMs = endTime.getTime() - startTime.getTime()
  const durationMinutes = Math.ceil(durationMs / (1000 * 60))
  const durationHours = durationMinutes / 60
  const durationDays = Math.ceil(durationHours / 24)

  let price = 0
  let breakdown: BookingPriceCalculation["breakdown"] | undefined

  switch (config.model) {
    case "HOURLY":
      if (!config.pricePerHour) {
        return {
          price: 0,
          isFree: true,
          reason: "Ingen timepris satt",
          pricingModel: "HOURLY"
        }
      }
      price = config.pricePerHour * durationHours
      breakdown = {
        basePrice: config.pricePerHour,
        hours: durationHours
      }
      break

    case "DAILY":
      if (!config.pricePerDay) {
        return {
          price: 0,
          isFree: true,
          reason: "Ingen døgnpris satt",
          pricingModel: "DAILY"
        }
      }
      price = config.pricePerDay * durationDays
      breakdown = {
        basePrice: config.pricePerDay,
        days: durationDays
      }
      break

    case "FIXED":
      if (!config.fixedPrice) {
        return {
          price: 0,
          isFree: true,
          reason: "Ingen fast pris satt",
          pricingModel: "FIXED"
        }
      }
      price = config.fixedPrice
      breakdown = {
        basePrice: config.fixedPrice
      }
      break

    case "FIXED_DURATION":
      if (!config.fixedPrice || !config.fixedPriceDuration) {
        return {
          price: 0,
          isFree: true,
          reason: "Ingen fast pris eller varighet satt",
          pricingModel: "FIXED_DURATION"
        }
      }
      // Hvis varigheten matcher fixedPriceDuration, bruk fast pris
      // Ellers beregn basert på timepris hvis tilgjengelig
      if (durationMinutes <= config.fixedPriceDuration) {
        price = config.fixedPrice
        breakdown = {
          basePrice: config.fixedPrice,
          duration: durationMinutes
        }
      } else if (config.pricePerHour) {
        // Hvis lengre enn fast pris-varighet, beregn timepris for hele perioden
        price = config.pricePerHour * durationHours
        breakdown = {
          basePrice: config.pricePerHour,
          hours: durationHours
        }
      } else {
        price = config.fixedPrice
        breakdown = {
          basePrice: config.fixedPrice,
          duration: durationMinutes
        }
      }
      break

    default:
      return {
        price: 0,
        isFree: true,
        reason: "Ukjent pris-modell",
        pricingModel: "FREE"
      }
  }

  return {
    price: Math.round(price * 100) / 100, // Rund av til 2 desimaler
    isFree: false,
    pricingModel: config.model,
    breakdown
  }
}

/**
 * Formaterer pris for visning
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("no-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price)
}

