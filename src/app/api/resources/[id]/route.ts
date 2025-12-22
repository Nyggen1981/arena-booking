import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { isPricingEnabled, hasPricingRules } from "@/lib/pricing"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const pricingEnabled = await isPricingEnabled()

    const resource = await prisma.resource.findUnique({
      where: { id },
      include: {
        category: true,
        parts: {
          where: { isActive: true },
          include: {
            parent: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: [
            { parentId: { sort: "asc", nulls: "first" } }, // Parents first
            { name: "asc" }
          ]
        },
      },
    })

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 })
    }

    // Hvis pricing er aktivert, filtrer ut deler uten prisregler
    if (pricingEnabled && resource.parts.length > 0) {
      const partsWithPricing = []
      for (const part of resource.parts) {
        const hasRules = await hasPricingRules(id, part.id)
        if (hasRules) {
          partsWithPricing.push(part)
        }
      }
      resource.parts = partsWithPricing
    }

    return NextResponse.json(resource)
  } catch (error: any) {
    console.error("Error fetching resource by id:", error)
    return NextResponse.json(
      {
        error: "Kunne ikke hente fasilitet",
        details: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}

