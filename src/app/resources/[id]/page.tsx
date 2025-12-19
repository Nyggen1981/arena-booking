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

            {/* Price info */}
            {resource.visPrisInfo && resource.prisInfo && (
              <div className="card p-6">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Prisinfo
                </h3>
                <div className="text-sm text-gray-600 whitespace-pre-line">
                  {resource.prisInfo}
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

