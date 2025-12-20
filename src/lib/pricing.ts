import { prisma } from "./prisma"
import { validateLicense } from "./license"
import { getUserRoleInfo } from "./roles"

export type PricingModel = "FREE" | "HOURLY" | "DAILY" | "FIXED" | "FIXED_DURATION"

export interface PricingRule {
  forRoles: string[] // Array av role IDs eller "admin", "user". Tom array = standard for alle andre
  model: PricingModel
  pricePerHour?: number | null
  pricePerDay?: number | null
  fixedPrice?: number | null
  fixedPriceDuration?: number | null // minutter
}

export interface PricingConfig {
  rules: PricingRule[] // Array av pris-regler
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
 * Støtter flere pris-regler per ressurs (én per rolle)
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
          pricingRules: true,
          // Legacy fields for bakoverkompatibilitet
          pricingModel: true,
          pricePerHour: true,
          pricePerDay: true,
          fixedPrice: true,
          fixedPriceDuration: true,
          freeForRoles: true,
          resource: {
            select: {
              pricingRules: true,
              // Legacy fields
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

      // Bruk part pricingRules hvis satt, ellers fallback til resource
      const pricingRulesJson = part.pricingRules || part.resource.pricingRules
      
      if (pricingRulesJson) {
        try {
          const rules = JSON.parse(pricingRulesJson) as PricingRule[]
          return { rules }
        } catch (e) {
          console.error("[Pricing] Error parsing pricingRules:", e)
        }
      }

      // Fallback til legacy format (konverter til nytt format)
      const legacyModel = (part.pricingModel || part.resource.pricingModel || "FREE") as PricingModel
      const legacyFreeForRoles = part.freeForRoles 
        ? JSON.parse(part.freeForRoles) 
        : (part.resource.freeForRoles ? JSON.parse(part.resource.freeForRoles) : [])
      
      const rules: PricingRule[] = []
      
      // Hvis det er roller med gratis tilgang, legg til regel for dem
      if (legacyFreeForRoles.length > 0) {
        rules.push({
          forRoles: legacyFreeForRoles,
          model: "FREE"
        })
      }
      
      // Legg til standard regel for alle andre
      rules.push({
        forRoles: [], // Tom array = standard for alle andre
        model: legacyModel,
        pricePerHour: part.pricePerHour ? Number(part.pricePerHour) : (part.resource.pricePerHour ? Number(part.resource.pricePerHour) : null),
        pricePerDay: part.pricePerDay ? Number(part.pricePerDay) : (part.resource.pricePerDay ? Number(part.resource.pricePerDay) : null),
        fixedPrice: part.fixedPrice ? Number(part.fixedPrice) : (part.resource.fixedPrice ? Number(part.resource.fixedPrice) : null),
        fixedPriceDuration: part.fixedPriceDuration ?? part.resource.fixedPriceDuration ?? null
      })
      
      return { rules }
    } else {
      // Hent pris fra ressurs
      const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        select: {
          pricingRules: true,
          // Legacy fields
          pricingModel: true,
          pricePerHour: true,
          pricePerDay: true,
          fixedPrice: true,
          fixedPriceDuration: true,
          freeForRoles: true
        }
      })

      if (!resource) return null

      // Bruk pricingRules hvis satt
      if (resource.pricingRules) {
        try {
          const rules = JSON.parse(resource.pricingRules) as PricingRule[]
          return { rules }
        } catch (e) {
          console.error("[Pricing] Error parsing pricingRules:", e)
        }
      }

      // Fallback til legacy format (konverter til nytt format)
      const legacyModel = (resource.pricingModel || "FREE") as PricingModel
      const legacyFreeForRoles = resource.freeForRoles ? JSON.parse(resource.freeForRoles) : []
      
      const rules: PricingRule[] = []
      
      // Hvis det er roller med gratis tilgang, legg til regel for dem
      if (legacyFreeForRoles.length > 0) {
        rules.push({
          forRoles: legacyFreeForRoles,
          model: "FREE"
        })
      }
      
      // Legg til standard regel for alle andre
      rules.push({
        forRoles: [], // Tom array = standard for alle andre
        model: legacyModel,
        pricePerHour: resource.pricePerHour ? Number(resource.pricePerHour) : null,
        pricePerDay: resource.pricePerDay ? Number(resource.pricePerDay) : null,
        fixedPrice: resource.fixedPrice ? Number(resource.fixedPrice) : null,
        fixedPriceDuration: resource.fixedPriceDuration ?? null
      })
      
      return { rules }
    }
  } catch (error) {
    console.error("[Pricing] Error getting pricing config:", error)
    return null
  }
}

/**
 * Finner riktig pris-regel for en bruker basert på deres roller
 */
async function findPricingRuleForUser(
  userId: string,
  rules: PricingRule[]
): Promise<{ rule: PricingRule | null; reason?: string }> {
  if (rules.length === 0) {
    return { rule: null }
  }

  try {
    const roleInfo = await getUserRoleInfo(userId)
    
    // Sjekk regler i rekkefølge - første match vinner
    for (const rule of rules) {
      // Hvis forRoles er tom, er det standard-regelen (brukes hvis ingen annen match)
      if (rule.forRoles.length === 0) {
        continue // Skip standard-regelen til vi har sjekket alle spesifikke
      }
      
      // Sjekk om brukeren er admin og admin er i listen
      if (roleInfo.isAdmin && rule.forRoles.includes("admin")) {
        return { 
          rule, 
          reason: rule.model === "FREE" ? "Gratis for administrator" : undefined 
        }
      }
      
      // Sjekk om brukeren har en custom role som er i listen
      if (roleInfo.customRole && rule.forRoles.includes(roleInfo.customRole.id)) {
        return { 
          rule, 
          reason: rule.model === "FREE" ? `Gratis for ${roleInfo.customRole.name}` : undefined 
        }
      }
      
      // Sjekk om systemRole "user" er i listen
      if (roleInfo.systemRole === "user" && rule.forRoles.includes("user")) {
        return { 
          rule, 
          reason: rule.model === "FREE" ? "Gratis for brukere" : undefined 
        }
      }
    }
    
    // Hvis ingen spesifikk match, bruk standard-regelen (forRoles er tom)
    const defaultRule = rules.find(r => r.forRoles.length === 0)
    if (defaultRule) {
      return { rule: defaultRule }
    }
    
    // Hvis ingen regel funnet, returner null (gratis)
    return { rule: null }
  } catch (error) {
    console.error("[Pricing] Error finding pricing rule:", error)
    return { rule: null }
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
  
  if (!config || config.rules.length === 0) {
    return {
      price: 0,
      isFree: true,
      reason: "Gratis booking",
      pricingModel: "FREE"
    }
  }

  // Finn riktig pris-regel for brukeren
  const ruleMatch = await findPricingRuleForUser(userId, config.rules)
  
  if (!ruleMatch.rule) {
    return {
      price: 0,
      isFree: true,
      reason: "Gratis booking",
      pricingModel: "FREE"
    }
  }

  const rule = ruleMatch.rule

  // Hvis modellen er FREE, returner gratis
  if (rule.model === "FREE") {
    return {
      price: 0,
      isFree: true,
      reason: ruleMatch.reason || "Gratis booking",
      pricingModel: "FREE"
    }
  }

  // Beregn varighet
  const durationMs = endTime.getTime() - startTime.getTime()
  const durationMinutes = Math.ceil(durationMs / (1000 * 60))
  const durationHours = durationMinutes / 60
  const durationDays = Math.ceil(durationHours / 24)

  let price = 0
  let breakdown: BookingPriceCalculation["breakdown"] | undefined

  switch (rule.model) {
    case "HOURLY":
      if (!rule.pricePerHour) {
        return {
          price: 0,
          isFree: true,
          reason: "Ingen timepris satt",
          pricingModel: "HOURLY"
        }
      }
      price = rule.pricePerHour * durationHours
      breakdown = {
        basePrice: rule.pricePerHour,
        hours: durationHours
      }
      break

    case "DAILY":
      if (!rule.pricePerDay) {
        return {
          price: 0,
          isFree: true,
          reason: "Ingen døgnpris satt",
          pricingModel: "DAILY"
        }
      }
      price = rule.pricePerDay * durationDays
      breakdown = {
        basePrice: rule.pricePerDay,
        days: durationDays
      }
      break

    case "FIXED":
      if (!rule.fixedPrice) {
        return {
          price: 0,
          isFree: true,
          reason: "Ingen fast pris satt",
          pricingModel: "FIXED"
        }
      }
      price = rule.fixedPrice
      breakdown = {
        basePrice: rule.fixedPrice
      }
      break

    case "FIXED_DURATION":
      if (!rule.fixedPrice || !rule.fixedPriceDuration) {
        return {
          price: 0,
          isFree: true,
          reason: "Ingen fast pris eller varighet satt",
          pricingModel: "FIXED_DURATION"
        }
      }
      // Hvis varigheten matcher fixedPriceDuration, bruk fast pris
      // Ellers beregn basert på timepris hvis tilgjengelig
      if (durationMinutes <= rule.fixedPriceDuration) {
        price = rule.fixedPrice
        breakdown = {
          basePrice: rule.fixedPrice,
          duration: durationMinutes
        }
      } else if (rule.pricePerHour) {
        // Hvis lengre enn fast pris-varighet, beregn timepris for hele perioden
        price = rule.pricePerHour * durationHours
        breakdown = {
          basePrice: rule.pricePerHour,
          hours: durationHours
        }
      } else {
        price = rule.fixedPrice
        breakdown = {
          basePrice: rule.fixedPrice,
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

