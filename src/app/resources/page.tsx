import { PageLayout } from "@/components/PageLayout"
import { ResourceFilter } from "@/components/ResourceFilter"
import { prisma } from "@/lib/prisma"

// Revalidate every 60 seconds
export const revalidate = 60

// Fetch resources directly (cache removed temporarily to debug)
async function getResources() {
  try {
    // First, check if we can connect to the database
    const resourceCount = await prisma.resource.count()
    console.log("Total resources in database:", resourceCount)
    
    const activeCount = await prisma.resource.count({ where: { isActive: true } })
    console.log("Active resources in database:", activeCount)
    
    const resources = await prisma.resource.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        location: true,
        image: true,
        color: true,
        minBookingMinutes: true,
        maxBookingMinutes: true,
        requiresApproval: true,
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        parts: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            capacity: true,
            mapCoordinates: true
            // Excluding adminNote since it doesn't exist in database yet
          },
          orderBy: { name: "asc" }
        },
      },
      orderBy: [
        { category: { name: "asc" } },
        { name: "asc" }
      ]
    })
    
    console.log("Fetched resources count:", resources.length)
    if (resources.length > 0) {
      console.log("First resource:", { id: resources[0].id, name: resources[0].name, isActive: resources[0].isActive })
    }
    
    return resources
  } catch (error) {
    console.error("Error fetching resources:", error)
    console.error("Error details:", JSON.stringify(error, null, 2))
    return []
  }
}

// Fetch categories directly (cache removed temporarily to debug)
async function getCategories() {
  try {
    return await prisma.resourceCategory.findMany({
      orderBy: { name: "asc" }
    })
  } catch (error) {
    console.error("Error fetching categories:", error)
    return []
  }
}

export default async function ResourcesPage() {
  const [resources, categories] = await Promise.all([
    getResources(),
    getCategories()
  ])

  // If no resources, show empty state instead of redirecting (to avoid redirect loops)
  if (resources.length === 0) {
    return (
      <PageLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen fasiliteter ennå</h2>
          <p className="text-gray-500 mb-6">Det er ingen fasiliteter tilgjengelige for øyeblikket.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Fasiliteter</h1>
          <p className="text-gray-500 mt-2">
            Utforsk alle tilgjengelige fasiliteter og book din neste treningsøkt
          </p>
        </div>
      </div>

      <ResourceFilter 
        categories={categories.map(c => ({
          id: c.id,
          name: c.name,
          color: c.color
        }))}
        resources={resources.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          location: r.location,
          image: r.image,
          minBookingMinutes: r.minBookingMinutes,
          maxBookingMinutes: r.maxBookingMinutes,
          requiresApproval: r.requiresApproval,
          category: r.category ? {
            id: r.category.id,
            name: r.category.name,
            color: r.category.color
          } : null,
          parts: r.parts.map(p => ({ id: p.id, name: p.name }))
        }))}
      />
    </PageLayout>
  )
}
