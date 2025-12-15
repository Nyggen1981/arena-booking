import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendEmail, getBookingApprovedEmail, getBookingRejectedEmail } from "@/lib/email"
import { format } from "date-fns"
import { nb } from "date-fns/locale"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  
  // Parse request body
  let body: { action?: string; status?: string; statusNote?: string; applyToAll?: boolean } = {}
  try {
    body = await request.json()
  } catch (jsonError) {
    try {
      const bodyText = await request.text()
      if (bodyText && bodyText.trim()) {
        body = JSON.parse(bodyText)
      } else {
        return NextResponse.json({ 
          error: "Request body is required"
        }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ 
        error: "Invalid request body"
      }, { status: 400 })
    }
  }

  // Support both 'action' and 'status' fields for backward compatibility
  let action: string | undefined = body.action
  const status = body.status as string | undefined
  
  // If action is not provided but status is, convert status to action
  if (!action && status) {
    if (status === "approved") {
      action = "approve"
    } else if (status === "rejected") {
      action = "reject"
    }
  }
  
  const { statusNote, applyToAll } = body

  // Validate action
  if (!action || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ 
      error: "Invalid action. Must be 'approve' or 'reject'"
    }, { status: 400 })
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: true,
      resource: true,
      resourcePart: true
    }
  })

  if (!booking || booking.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 })
  }

  // Determine which bookings to update
  let bookingIdsToUpdate: string[] = [id]

  if (applyToAll && booking.isRecurring) {
    // Find all related recurring bookings (same parent or this is the parent)
    const parentId = booking.parentBookingId || booking.id
    
    const relatedBookings = await prisma.booking.findMany({
      where: {
        organizationId: session.user.organizationId,
        status: "pending",
        OR: [
          { id: parentId },
          { parentBookingId: parentId }
        ]
      },
      select: { id: true }
    })
    
    bookingIdsToUpdate = relatedBookings.map(b => b.id)
  }

  // Determine the new status
  const newStatus = action === "approve" ? "approved" : "rejected"

  // Update all selected bookings
  await prisma.booking.updateMany({
    where: { id: { in: bookingIdsToUpdate } },
    data: {
      status: newStatus,
      statusNote: statusNote || null,
      approvedAt: action === "approve" ? new Date() : null,
      approvedById: action === "approve" ? session.user.id : null
    }
  })

  // Send email notification (non-blocking - don't await)
  const userEmail = booking.contactEmail || booking.user.email
  if (userEmail) {
    const date = format(new Date(booking.startTime), "EEEE d. MMMM yyyy", { locale: nb })
    const time = `${format(new Date(booking.startTime), "HH:mm")} - ${format(new Date(booking.endTime), "HH:mm")}`
    const resourceName = booking.resourcePart 
      ? `${booking.resource.name} → ${booking.resourcePart.name}`
      : booking.resource.name
    const count = bookingIdsToUpdate.length

    // Fire and forget - don't block the response
    const sendEmailAsync = async () => {
      try {
        if (action === "approve") {
          const adminNote = (booking.resourcePart as any)?.adminNote || null
          const emailContent = await getBookingApprovedEmail(
            booking.organizationId,
            booking.title, 
            resourceName, 
            count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
            time,
            adminNote
          )
          await sendEmail(booking.organizationId, { to: userEmail, ...emailContent })
        } else {
          const emailContent = await getBookingRejectedEmail(
            booking.organizationId,
            booking.title, 
            resourceName, 
            count > 1 ? `${date} (og ${count - 1} andre datoer)` : date, 
            time, 
            statusNote
          )
          await sendEmail(booking.organizationId, { to: userEmail, ...emailContent })
        }
      } catch (error) {
        console.error("Failed to send email:", error)
      }
    }

    // Don't await - let it run in background
    void sendEmailAsync()
  }

  return NextResponse.json({ 
    id,
    status: newStatus,
    updatedCount: bookingIdsToUpdate.length 
  })
}
