import { prisma } from "./prisma"

/**
 * Oppretter en faktura for en booking
 */
export async function createInvoiceForBooking(
  bookingId: string,
  organizationId: string
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  // Hent booking med relaterte data
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: true,
      resource: true,
      resourcePart: true,
      organization: true
    }
  })

  if (!booking) {
    throw new Error("Booking not found")
  }

  if (!booking.totalAmount || booking.totalAmount <= 0) {
    throw new Error("Booking has no amount to invoice")
  }

  // Generer fakturanummer (YYYY-NNNN format)
  const year = new Date().getFullYear()
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      organizationId,
      invoiceNumber: {
        startsWith: `${year}-`
      }
    },
    orderBy: {
      invoiceNumber: "desc"
    }
  })

  let invoiceNumber: string
  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split("-")[1] || "0")
    invoiceNumber = `${year}-${String(lastNumber + 1).padStart(4, "0")}`
  } else {
    invoiceNumber = `${year}-0001`
  }

  // Beregn MVA (25% standard for Norge)
  const taxRate = 0.25
  const subtotal = Number(booking.totalAmount) / (1 + taxRate)
  const taxAmount = Number(booking.totalAmount) - subtotal
  const totalAmount = Number(booking.totalAmount)

  // Sett forfallsdato (standard 14 dager)
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 14)

  // Opprett faktura
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      organizationId,
      status: "DRAFT",
      dueDate,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      billingName: booking.contactName || booking.user.name || "",
      billingEmail: booking.contactEmail || booking.user.email || "",
      billingPhone: booking.contactPhone || booking.user.phone || null,
      bookings: {
        connect: { id: bookingId }
      }
    }
  })

  // Oppdater booking med faktura-ID
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      invoiceId: invoice.id
    }
  })

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber
  }
}



