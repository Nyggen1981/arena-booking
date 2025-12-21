import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { 
  MapPin, 
  Clock, 
  Calendar,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Users,
  X
} from "lucide-react"
import { ResourceCalendar } from "@/components/ResourceCalendar"
import { MapViewer } from "@/components/MapViewer"
import { PartsList } from "@/components/PartsList"
import { getPricingConfig, isPricingEnabled, PricingModel, findPricingRuleForUser } from "@/lib/pricing"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserRoleInfo } from "@/lib/roles"

// Revalidate every 30 seconds for fresh data
export const revalidate = 30

interface Props {
  params: Promise<{ id: string }>
}

// Fetch resource data directly without unstable_cache to avoid caching issues
async function getResource(id: string) {
  try {
    const now = new Date()
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const twoMonthsAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

    return await prisma.resource.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true
          }
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        parts: {
          where: { isActive: true },
          include: {
            children: {
              where: { isActive: true },
              select: { id: true, name: true }
            }
          },
          orderBy: { name: "asc" }
        },
        bookings: {
          where: {
            status: { in: ["approved", "pending"] },
            startTime: { gte: twoWeeksAgo, lte: twoMonthsAhead }
          },
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            status: true,
            isRecurring: true,
            parentBookingId: true,
            userId: true,
            resourcePartId: true,
            resourcePart: {
              select: {
                id: true,
                name: true,
                parentId: true
              }
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { startTime: "asc" }
        }
      }
    })
  } catch (error) {
    console.error("Error fetching resource:", error)
    return null
  }
}

// Sort parts hierarchically (parents first, then children, sorted by name at each level)
function sortPartsHierarchically(parts: Array<{ id: string; name: string; description: string | null; capacity: number | null; image: string | null; parentId: string | null; children?: Array<{ id: string; name: string }> }>) {
  type PartType = typeof parts[0]
  const partMap = new Map<string, PartType & { children: PartType[] }>()
  const roots: (PartType & { children: PartType[] })[] = []

  // First pass: create map
  parts.forEach(part => {
    partMap.set(part.id, { ...part, children: [] })
  })

  // Second pass: build tree using parentId
  parts.forEach(part => {
    const node = partMap.get(part.id)!
    if (part.parentId && partMap.has(part.parentId)) {
      const parent = partMap.get(part.parentId)!
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  // Flatten tree maintaining hierarchy order
  const result: PartType[] = []
  function flatten(partsToFlatten: (PartType & { children: PartType[] })[], level: number = 0) {
    // Sort each level by name
    const sorted = [...partsToFlatten].sort((a, b) => a.name.localeCompare(b.name, 'no'))
    sorted.forEach(part => {
      // Remove children property when adding to result
      const { children: _, ...partWithoutChildren } = part
      result.push(partWithoutChildren as PartType)
      if (part.children && part.children.length > 0) {
        flatten(part.children as (PartType & { children: PartType[] })[], level + 1)
      }
    })
  }
  flatten(roots)
  return result
}

export default async function ResourcePage({ params }: Props) {
  const { id } = await params
  const resource = await getResource(id)

  if (!resource) {
    notFound()
  }

  // Sort parts hierarchically
  // Map parts to ensure image field is included (TypeScript may not recognize it if Prisma client is outdated)
  const partsWithImage = resource.parts.map(p => ({
    ...p,
    image: (p as any).image || null
  }))
  const sortedParts = sortPartsHierarchically(partsWithImage)

  const openingHours = resource.openingHours 
    ? JSON.parse(resource.openingHours) 
    : null

  const dayNames: Record<string, string> = {
    monday: "Mandag",
    tuesday: "Tirsdag",
    wednesday: "Onsdag",
    thursday: "Torsdag",
    friday: "Fredag",
    saturday: "Lørdag",
    sunday: "Søndag"
  }

  // Hent session for å finne relevant prislogikk
  const session = await getServerSession(authOptions)
  
  // Hent prislogikk-konfigurasjon (kun hvis aktivert)
  const pricingEnabled = await isPricingEnabled()
  const pricingConfig = pricingEnabled ? await getPricingConfig(id, null) : null
  
  // Finn relevant prisregel for den innloggede brukeren (kun hvis allowWholeBooking er true)
  let relevantRule: { rule: any; reason?: string } | null = null
  let customRoles: Array<{ id: string; name: string }> = []
  let partsPricing: Array<{ partId: string; partName: string; rule: any; reason?: string }> = []
  
  if (pricingEnabled && session?.user?.id) {
    try {
      // Hent custom roles for å vise navn i pris-regler
      customRoles = await prisma.customRole.findMany({
        where: { organizationId: resource.organizationId },
        select: { id: true, name: true }
      })
      
      // Hvis allowWholeBooking er true, hent fasilitetsprisen
      if (resource.allowWholeBooking && pricingConfig?.rules) {
        // Bruk findPricingRuleForUser fra pricing.ts for konsistent logikk
        relevantRule = await findPricingRuleForUser(session.user.id, pricingConfig.rules)
      }
      
      // Hent relevante regler for hoveddeler og underdeler (alltid hvis det finnes deler)
      if (resource.parts.length > 0 && session?.user?.id) {
        for (const part of resource.parts) {
          const partPricingConfig = await getPricingConfig(id, part.id)
          if (partPricingConfig?.rules) {
            const partRule = await findPricingRuleForUser(session.user.id, partPricingConfig.rules)
            if (partRule?.rule) {
              partsPricing.push({
                partId: part.id,
                partName: part.name,
                rule: partRule.rule,
                reason: partRule.reason
              })
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading pricing rules:", error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* Hero */}
      <div className="relative h-64 md:h-80">
        {resource.image ? (
          <Image
            src={resource.image}
            alt={resource.name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div 
            className="absolute inset-0"
            style={{ 
              background: `linear-gradient(135deg, ${resource.category?.color || '#3b82f6'}ee, ${resource.category?.color || '#3b82f6'}88)`
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/20" />
        <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-8">
          <Link 
            href="/resources" 
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Tilbake til fasiliteter
          </Link>
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm mb-3">
              {resource.category?.name || "Fasilitet"}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold text-white">{resource.name}</h1>
            {resource.location && (
              <p className="text-white/80 flex items-center gap-2 mt-2">
                <MapPin className="w-5 h-5" />
                {resource.location}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {resource.description && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Om fasiliteten</h2>
                <p className="text-gray-600">{resource.description}</p>
              </div>
            )}

            {/* Map Overview */}
            {resource.mapImage && resource.parts.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  Oversiktskart
                </h2>
                <MapViewer
                  mapImage={resource.mapImage}
                  parts={resource.parts.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    capacity: p.capacity,
                    mapCoordinates: p.mapCoordinates
                  }))}
                  resourceColor={resource.color || resource.category?.color}
                />
              </div>
            )}

            {/* Calendar */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Kalender
              </h2>
              <ResourceCalendar 
                resourceId={resource.id}
                resourceName={resource.name}
                bookings={resource.bookings.map(b => ({
                  id: b.id,
                  title: b.title,
                  startTime: (b.startTime instanceof Date ? b.startTime : new Date(b.startTime)).toISOString(),
                  endTime: (b.endTime instanceof Date ? b.endTime : new Date(b.endTime)).toISOString(),
                  status: b.status,
                  resourcePartId: b.resourcePartId,
                  resourcePartName: b.resourcePart?.name,
                  resourcePartParentId: b.resourcePart?.parentId,
                  userId: b.userId,
                  userName: b.user?.name,
                  userEmail: b.user?.email,
                  isRecurring: b.isRecurring || false,
                  parentBookingId: b.parentBookingId
                }))}
                parts={resource.parts.map(p => ({ 
                  id: p.id, 
                  name: p.name,
                  parentId: p.parentId,
                  children: p.children
                }))}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Book button */}
            <Link
              href={`/resources/${resource.id}/book`}
              className="btn btn-primary w-full py-4 text-lg"
            >
              <Calendar className="w-5 h-5" />
              Book nå
            </Link>

            {/* Quick info */}
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Booking-info</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Varighet</p>
                    <p className="text-sm text-gray-500">
                      {resource.minBookingMinutes !== 0 && resource.maxBookingMinutes !== 9999
                        ? `${resource.minBookingMinutes} - ${resource.maxBookingMinutes} minutter`
                        : "Ubegrenset varighet"
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Forhåndsbestilling</p>
                    <p className="text-sm text-gray-500">
                      {resource.advanceBookingDays 
                        ? `Inntil ${resource.advanceBookingDays} dager frem`
                        : "Ubegrenset antall dager"
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  {resource.requiresApproval ? (
                    <>
                      <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Godkjenning</p>
                        <p className="text-sm text-gray-500">
                          Krever godkjenning fra admin
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Godkjenning</p>
                        <p className="text-sm text-gray-500">
                          Automatisk godkjent
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Price info - Kun for standardlisens (ikke "pris & betaling" modul) */}
            {!pricingEnabled && resource.visPrisInfo && resource.prisInfo && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Prisinfo
                </h3>
                <div className="text-sm text-gray-600 whitespace-pre-line">
                  {resource.prisInfo}
                </div>
              </div>
            )}

            {/* Pricing Logic (kun hvis "pris & betaling" modul er aktivert og visPrislogikk er true) */}
            {pricingEnabled && resource.visPrislogikk && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Prisinfo
                </h3>
                <div className="space-y-4">
                  {/* Vis fasilitetspris kun hvis allowWholeBooking er true */}
                  {resource.allowWholeBooking && relevantRule && relevantRule.rule ? (
                    (() => {
                      const rule = relevantRule.rule
                      const isMember = session?.user?.isMember ?? false
                      const isDefaultRule = rule.forRoles.length === 0
                      
                      console.log("[Facility Page] Displaying pricing rule:", {
                        model: rule.model,
                        isMember,
                        isDefaultRule,
                        memberPricePerHour: rule.memberPricePerHour,
                        nonMemberPricePerHour: rule.nonMemberPricePerHour,
                        memberPricePerDay: rule.memberPricePerDay,
                        nonMemberPricePerDay: rule.nonMemberPricePerDay,
                        memberFixedPrice: rule.memberFixedPrice,
                        nonMemberFixedPrice: rule.nonMemberFixedPrice,
                        forRoles: rule.forRoles
                      })
                      
                      const getPricingDescription = (model: PricingModel) => {
                        switch (model) {
                          case "FREE":
                            // Hvis dette er standardregelen og den er satt til FREE, vis en mer informativ melding
                            if (isDefaultRule) {
                              return "Gratis (standardregel er satt til 'Gratis' - kontakt administrator for å sette priser)"
                            }
                            return "Gratis"
                          case "HOURLY":
                            // Vis pris basert på medlemsstatus
                            // Bruk samme fallback-logikk som i calculateBookingPrice
                            const hourlyPrice = isMember 
                              ? (rule.memberPricePerHour ?? rule.nonMemberPricePerHour)
                              : (rule.nonMemberPricePerHour ?? rule.memberPricePerHour)
                            
                            if (hourlyPrice === null || hourlyPrice === undefined || hourlyPrice === 0) {
                              return "Per time (pris ikke satt - kontakt administrator)"
                            }
                            
                            // Bestem hvilken type pris som brukes for visning
                            if (isMember && rule.memberPricePerHour !== null && rule.memberPricePerHour !== undefined) {
                              return `${Number(rule.memberPricePerHour).toFixed(2)} kr/time (medlemspris)`
                            } else if (!isMember && rule.nonMemberPricePerHour !== null && rule.nonMemberPricePerHour !== undefined) {
                              return `${Number(rule.nonMemberPricePerHour).toFixed(2)} kr/time`
                            } else {
                              // Fallback til den andre prisen
                              return `${Number(hourlyPrice).toFixed(2)} kr/time`
                            }
                        case "DAILY":
                          // Vis pris basert på medlemsstatus
                          // Bruk samme fallback-logikk som i calculateBookingPrice
                          const dailyPrice = isMember
                            ? (rule.memberPricePerDay ?? rule.nonMemberPricePerDay)
                            : (rule.nonMemberPricePerDay ?? rule.memberPricePerDay)
                          
                          if (dailyPrice === null || dailyPrice === undefined || dailyPrice === 0) {
                            return "Per døgn (pris ikke satt - kontakt administrator)"
                          }
                          
                          // Bestem hvilken type pris som brukes for visning
                          if (isMember && rule.memberPricePerDay !== null && rule.memberPricePerDay !== undefined) {
                            return `${Number(rule.memberPricePerDay).toFixed(2)} kr/døgn (medlemspris)`
                          } else if (!isMember && rule.nonMemberPricePerDay !== null && rule.nonMemberPricePerDay !== undefined) {
                            return `${Number(rule.nonMemberPricePerDay).toFixed(2)} kr/døgn`
                          } else {
                            // Fallback til den andre prisen
                            return `${Number(dailyPrice).toFixed(2)} kr/døgn`
                          }
                        case "FIXED_DURATION":
                          // Vis pris basert på medlemsstatus
                          // Bruk samme fallback-logikk som i calculateBookingPrice
                          const fixedPriceForDuration = isMember
                            ? (rule.memberFixedPrice ?? rule.nonMemberFixedPrice)
                            : (rule.nonMemberFixedPrice ?? rule.memberFixedPrice)
                          
                          if (fixedPriceForDuration === null || fixedPriceForDuration === undefined || fixedPriceForDuration === 0) {
                            return rule.fixedPriceDuration
                              ? `Fast pris (ikke satt - kontakt administrator) for ${rule.fixedPriceDuration} minutter`
                              : "Fast pris med varighet (ikke konfigurert - kontakt administrator)"
                          }
                          
                          // Bestem hvilken type pris som brukes for visning
                          let priceText = ""
                          if (isMember && rule.memberFixedPrice !== null && rule.memberFixedPrice !== undefined) {
                            priceText = `${Number(rule.memberFixedPrice).toFixed(2)} kr (medlemspris)`
                          } else if (!isMember && rule.nonMemberFixedPrice !== null && rule.nonMemberFixedPrice !== undefined) {
                            priceText = `${Number(rule.nonMemberFixedPrice).toFixed(2)} kr`
                          } else {
                            // Fallback til den andre prisen
                            priceText = `${Number(fixedPriceForDuration).toFixed(2)} kr`
                          }
                          
                          return rule.fixedPriceDuration
                            ? `${priceText} for ${rule.fixedPriceDuration} minutter`
                            : "Fast pris med varighet (ikke konfigurert)"
                        default:
                          return "Ukjent modell"
                      }
                    }

                      // Hvis ikke-medlem og både medlemspris og ikke-medlemspris er satt, vis begge
                      const showMemberComparison = !isMember && 
                        ((rule.memberPricePerHour !== null && rule.memberPricePerHour !== undefined && rule.nonMemberPricePerHour !== null && rule.nonMemberPricePerHour !== undefined) ||
                         (rule.memberPricePerDay !== null && rule.memberPricePerDay !== undefined && rule.nonMemberPricePerDay !== null && rule.nonMemberPricePerDay !== undefined) ||
                         (rule.memberFixedPrice !== null && rule.memberFixedPrice !== undefined && rule.nonMemberFixedPrice !== null && rule.nonMemberFixedPrice !== undefined))
                      
                      return (
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                Din pris
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {getPricingDescription(rule.model)}
                              </p>
                              
                              {showMemberComparison && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <p className="text-sm font-medium text-blue-900 mb-1">
                                    Medlemspris:
                                  </p>
                                  {rule.model === "HOURLY" && rule.memberPricePerHour !== null && rule.memberPricePerHour !== undefined && (
                                    <p className="text-sm text-blue-700">
                                      {Number(rule.memberPricePerHour).toFixed(2)} kr/time
                                      {rule.nonMemberPricePerHour !== null && rule.nonMemberPricePerHour !== undefined && (
                                        <span className="ml-2 text-xs text-blue-600">
                                          (Spar {Number(rule.nonMemberPricePerHour - rule.memberPricePerHour).toFixed(2)} kr/time)
                                        </span>
                                      )}
                                    </p>
                                  )}
                                  {rule.model === "DAILY" && rule.memberPricePerDay !== null && rule.memberPricePerDay !== undefined && (
                                    <p className="text-sm text-blue-700">
                                      {Number(rule.memberPricePerDay).toFixed(2)} kr/døgn
                                      {rule.nonMemberPricePerDay !== null && rule.nonMemberPricePerDay !== undefined && (
                                        <span className="ml-2 text-xs text-blue-600">
                                          (Spar {Number(rule.nonMemberPricePerDay - rule.memberPricePerDay).toFixed(2)} kr/døgn)
                                        </span>
                                      )}
                                    </p>
                                  )}
                                  {rule.model === "FIXED_DURATION" && rule.memberFixedPrice !== null && rule.memberFixedPrice !== undefined && (
                                    <p className="text-sm text-blue-700">
                                      {Number(rule.memberFixedPrice).toFixed(2)} kr
                                      {rule.fixedPriceDuration && ` for ${rule.fixedPriceDuration} minutter`}
                                      {rule.nonMemberFixedPrice !== null && rule.nonMemberFixedPrice !== undefined && (
                                        <span className="ml-2 text-xs text-blue-600">
                                          (Spar {Number(rule.nonMemberFixedPrice - rule.memberFixedPrice).toFixed(2)} kr)
                                        </span>
                                      )}
                                    </p>
                                  )}
                                </div>
                              )}
                              
                              {relevantRule.reason && (
                                <p className="text-xs text-gray-500 mt-1 italic">
                                  {relevantRule.reason}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })()
                  ) : resource.allowWholeBooking ? (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-600">
                        Ingen prisregel funnet for din rolle. Kontakt administrator for mer informasjon.
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Debug: pricingEnabled={pricingEnabled ? "true" : "false"}, visPrislogikk={resource.visPrislogikk ? "true" : "false"}, relevantRule={relevantRule ? "found" : "null"}, rulesCount={pricingConfig?.rules?.length || 0}
                      </p>
                    </div>
                  ) : null}
                  
                  {/* Vis priser for hoveddeler og underdeler (alltid hvis det finnes deler med priser) */}
                  {partsPricing.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-700">Priser for deler:</h4>
                      {partsPricing.map(({ partId, partName, rule, reason }) => {
                        const isMember = session?.user?.isMember ?? false
                        
                        const getPricingDescription = (model: PricingModel) => {
                          switch (model) {
                            case "FREE":
                              return "Gratis"
                            case "HOURLY":
                              const hourlyPrice = isMember 
                                ? (rule.memberPricePerHour ?? rule.nonMemberPricePerHour)
                                : (rule.nonMemberPricePerHour ?? rule.memberPricePerHour)
                              
                              if (hourlyPrice === null || hourlyPrice === undefined || hourlyPrice === 0) {
                                return "Per time (pris ikke satt)"
                              }
                              
                              if (isMember && rule.memberPricePerHour !== null && rule.memberPricePerHour !== undefined) {
                                return `${Number(rule.memberPricePerHour).toFixed(2)} kr/time (medlemspris)`
                              } else if (!isMember && rule.nonMemberPricePerHour !== null && rule.nonMemberPricePerHour !== undefined) {
                                return `${Number(rule.nonMemberPricePerHour).toFixed(2)} kr/time`
                              } else {
                                return `${Number(hourlyPrice).toFixed(2)} kr/time`
                              }
                            case "DAILY":
                              const dailyPrice = isMember
                                ? (rule.memberPricePerDay ?? rule.nonMemberPricePerDay)
                                : (rule.nonMemberPricePerDay ?? rule.memberPricePerDay)
                              
                              if (dailyPrice === null || dailyPrice === undefined || dailyPrice === 0) {
                                return "Per døgn (pris ikke satt)"
                              }
                              
                              if (isMember && rule.memberPricePerDay !== null && rule.memberPricePerDay !== undefined) {
                                return `${Number(rule.memberPricePerDay).toFixed(2)} kr/døgn (medlemspris)`
                              } else if (!isMember && rule.nonMemberPricePerDay !== null && rule.nonMemberPricePerDay !== undefined) {
                                return `${Number(rule.nonMemberPricePerDay).toFixed(2)} kr/døgn`
                              } else {
                                return `${Number(dailyPrice).toFixed(2)} kr/døgn`
                              }
                            case "FIXED_DURATION":
                              const fixedPriceForDuration = isMember
                                ? (rule.memberFixedPrice ?? rule.nonMemberFixedPrice)
                                : (rule.nonMemberFixedPrice ?? rule.memberFixedPrice)
                              
                              if (fixedPriceForDuration === null || fixedPriceForDuration === undefined || fixedPriceForDuration === 0) {
                                return rule.fixedPriceDuration
                                  ? `Fast pris (ikke satt) for ${rule.fixedPriceDuration} minutter`
                                  : "Fast pris med varighet (ikke konfigurert)"
                              }
                              
                              let priceText = ""
                              if (isMember && rule.memberFixedPrice !== null && rule.memberFixedPrice !== undefined) {
                                priceText = `${Number(rule.memberFixedPrice).toFixed(2)} kr (medlemspris)`
                              } else if (!isMember && rule.nonMemberFixedPrice !== null && rule.nonMemberFixedPrice !== undefined) {
                                priceText = `${Number(rule.nonMemberFixedPrice).toFixed(2)} kr`
                              } else {
                                priceText = `${Number(fixedPriceForDuration).toFixed(2)} kr`
                              }
                              
                              return rule.fixedPriceDuration
                                ? `${priceText} for ${rule.fixedPriceDuration} minutter`
                                : "Fast pris med varighet (ikke konfigurert)"
                            default:
                              return "Ukjent modell"
                          }
                        }
                        
                        // Hvis ikke-medlem og både medlemspris og ikke-medlemspris er satt, vis begge
                        const showMemberComparison = !isMember && 
                          ((rule.memberPricePerHour !== null && rule.memberPricePerHour !== undefined && rule.nonMemberPricePerHour !== null && rule.nonMemberPricePerHour !== undefined) ||
                           (rule.memberPricePerDay !== null && rule.memberPricePerDay !== undefined && rule.nonMemberPricePerDay !== null && rule.nonMemberPricePerDay !== undefined) ||
                           (rule.memberFixedPrice !== null && rule.memberFixedPrice !== undefined && rule.nonMemberFixedPrice !== null && rule.nonMemberFixedPrice !== undefined))
                        
                        return (
                          <div key={partId} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-sm font-medium text-gray-900">{partName}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {getPricingDescription(rule.model)}
                            </p>
                            
                            {showMemberComparison && (
                              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                                <p className="text-xs font-medium text-blue-900 mb-1">
                                  Medlemspris:
                                </p>
                                {rule.model === "HOURLY" && rule.memberPricePerHour !== null && rule.memberPricePerHour !== undefined && (
                                  <p className="text-xs text-blue-700">
                                    {Number(rule.memberPricePerHour).toFixed(2)} kr/time
                                    {rule.nonMemberPricePerHour !== null && rule.nonMemberPricePerHour !== undefined && (
                                      <span className="ml-2 text-blue-600">
                                        (Spar {Number(rule.nonMemberPricePerHour - rule.memberPricePerHour).toFixed(2)} kr/time)
                                      </span>
                                    )}
                                  </p>
                                )}
                                {rule.model === "DAILY" && rule.memberPricePerDay !== null && rule.memberPricePerDay !== undefined && (
                                  <p className="text-xs text-blue-700">
                                    {Number(rule.memberPricePerDay).toFixed(2)} kr/døgn
                                    {rule.nonMemberPricePerDay !== null && rule.nonMemberPricePerDay !== undefined && (
                                      <span className="ml-2 text-blue-600">
                                        (Spar {Number(rule.nonMemberPricePerDay - rule.memberPricePerDay).toFixed(2)} kr/døgn)
                                      </span>
                                    )}
                                  </p>
                                )}
                                {rule.model === "FIXED_DURATION" && rule.memberFixedPrice !== null && rule.memberFixedPrice !== undefined && (
                                  <p className="text-xs text-blue-700">
                                    {Number(rule.memberFixedPrice).toFixed(2)} kr
                                    {rule.fixedPriceDuration && ` for ${rule.fixedPriceDuration} minutter`}
                                    {rule.nonMemberFixedPrice !== null && rule.nonMemberFixedPrice !== undefined && (
                                      <span className="ml-2 text-blue-600">
                                        (Spar {Number(rule.nonMemberFixedPrice - rule.memberFixedPrice).toFixed(2)} kr)
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                            )}
                            
                            {reason && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                {reason}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  
                  {partsPricing.length === 0 && resource.parts.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-600">
                        Ingen prisregler funnet for delene. Kontakt administrator for mer informasjon.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Parts */}
            {resource.parts.length > 0 && (
              <PartsList 
                parts={partsWithImage}
                sortedParts={sortedParts}
              />
            )}

            {/* Opening hours */}
            {openingHours && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Åpningstider</h3>
                <div className="space-y-2">
                  {Object.entries(openingHours).map(([day, hours]) => {
                    const h = hours as { open: string; close: string }
                    return (
                      <div key={day} className="flex justify-between text-sm">
                        <span className="text-gray-600">{dayNames[day]}</span>
                        <span className="text-gray-900 font-medium">
                          {h.open} - {h.close}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

