import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

