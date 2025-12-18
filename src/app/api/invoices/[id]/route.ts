import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Get a specific invoice
 * GET /api/invoices/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        bookings: {
          include: {
            resource: true,
            resourcePart: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            createdAt: "desc",
          },
        },
        organization: {
          select: {
            name: true,
            logo: true,
          },
        },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    // Check if user has access
    if (invoice.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({ invoice })
  } catch (error: any) {
    console.error("Error fetching invoice:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch invoice" },
      { status: 500 }
    )
  }
}

/**
 * Update invoice status
 * PATCH /api/invoices/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can update invoices
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { status, notes } = body

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    if (invoice.organizationId !== session.user.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id: params.id },
      data: {
        ...(status && { status: status as any }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        bookings: {
          include: {
            resource: true,
            resourcePart: true,
          },
        },
        payments: true,
      },
    })

    return NextResponse.json({ invoice: updatedInvoice })
  } catch (error: any) {
    console.error("Error updating invoice:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update invoice" },
      { status: 500 }
    )
  }
}


