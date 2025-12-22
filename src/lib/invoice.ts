import { prisma } from "./prisma"
import { sendEmail } from "./email"
import { format } from "date-fns"
import { nb } from "date-fns/locale"
import { generateInvoicePDF } from "./invoice-pdf"

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

  if (!booking.totalAmount || Number(booking.totalAmount) <= 0) {
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

/**
 * Sender faktura til kunde via e-post
 */
export async function sendInvoiceEmail(
  invoiceId: string,
  organizationId: string
): Promise<boolean> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      organization: {
        select: {
          name: true,
          logo: true,
          invoiceAddress: true,
          invoicePhone: true,
          invoiceEmail: true,
          invoiceOrgNumber: true,
          invoiceBankAccount: true,
          invoiceNotes: true,
        }
      },
      bookings: {
        include: {
          resource: true,
          resourcePart: true,
          user: true
        }
      }
    }
  })

  if (!invoice) {
    throw new Error("Invoice not found")
  }

  const booking = invoice.bookings[0]
  if (!booking) {
    throw new Error("Invoice has no bookings")
  }

  // Generate PDF invoice
  const resourceName = booking.resourcePart 
    ? `${booking.resource.name} → ${booking.resourcePart.name}`
    : booking.resource.name

  const invoiceDate = invoice.createdAt
  const pdfBuffer = await generateInvoicePDF({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate,
    dueDate: invoice.dueDate,
    organization: {
      name: invoice.organization.name,
      logo: invoice.organization.logo,
      invoiceAddress: invoice.organization.invoiceAddress,
      invoicePhone: invoice.organization.invoicePhone,
      invoiceEmail: invoice.organization.invoiceEmail,
      invoiceOrgNumber: invoice.organization.invoiceOrgNumber,
      invoiceBankAccount: invoice.organization.invoiceBankAccount,
      invoiceNotes: invoice.organization.invoiceNotes,
    },
    billing: {
      name: invoice.billingName,
      email: invoice.billingEmail,
      phone: invoice.billingPhone,
      address: invoice.billingAddress,
    },
    items: invoice.bookings.map(b => ({
      description: `${b.title} - ${resourceName} (${format(new Date(b.startTime), "d. MMM yyyy HH:mm", { locale: nb })} - ${format(new Date(b.endTime), "HH:mm", { locale: nb })})`,
      quantity: 1,
      unitPrice: Number(b.totalAmount || 0) / (1 + Number(invoice.taxRate)),
      total: Number(b.totalAmount || 0) / (1 + Number(invoice.taxRate)),
    })),
    subtotal: Number(invoice.subtotal),
    taxRate: Number(invoice.taxRate),
    taxAmount: Number(invoice.taxAmount),
    totalAmount: Number(invoice.totalAmount),
    notes: invoice.notes,
  })

  const date = format(new Date(booking.startTime), "EEEE d. MMMM yyyy", { locale: nb })
  const time = `${format(new Date(booking.startTime), "HH:mm")} - ${format(new Date(booking.endTime), "HH:mm")}`
  const dueDateFormatted = format(new Date(invoice.dueDate), "d. MMMM yyyy", { locale: nb })

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
        .invoice-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .invoice-details table { width: 100%; border-collapse: collapse; }
        .invoice-details td { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .invoice-details td:last-child { text-align: right; font-weight: 600; }
        .total-row { font-size: 18px; font-weight: 700; color: #1f2937; }
        .footer { text-align: center; padding: 20px; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Faktura ${invoice.invoiceNumber}</h1>
        </div>
        <div class="content">
          <p>Hei ${invoice.billingName},</p>
          
          <p>Takk for din booking! Vedlagt finner du faktura for følgende booking:</p>
          
          <div class="info-box">
            <p><strong>Arrangement:</strong> ${booking.title}</p>
            <p><strong>Fasilitet:</strong> ${resourceName}</p>
            <p><strong>Dato:</strong> ${date}</p>
            <p><strong>Tid:</strong> ${time}</p>
          </div>

          <div class="invoice-details">
            <h3 style="margin-top: 0;">Fakturaoversikt</h3>
            <table>
              <tr>
                <td>Beløp eks. MVA:</td>
                <td>${Number(invoice.subtotal).toFixed(2)} kr</td>
              </tr>
              <tr>
                <td>MVA (${(Number(invoice.taxRate) * 100).toFixed(0)}%):</td>
                <td>${Number(invoice.taxAmount).toFixed(2)} kr</td>
              </tr>
              <tr class="total-row">
                <td>Totalt inkl. MVA:</td>
                <td>${Number(invoice.totalAmount).toFixed(2)} kr</td>
              </tr>
            </table>
            <p style="margin-top: 20px; color: #64748b; font-size: 14px;">
              <strong>Forfallsdato:</strong> ${dueDateFormatted}
            </p>
          </div>

          <p>Vennligst betal innen forfallsdatoen.</p>
        </div>
        <div class="footer">
          <p>Med vennlig hilsen,<br/>${invoice.organization.name}</p>
        </div>
      </div>
    </body>
    </html>
  `

  const success = await sendEmail(organizationId, {
    to: invoice.billingEmail,
    subject: `Faktura ${invoice.invoiceNumber} - ${booking.title}`,
    html,
    attachments: [
      {
        filename: `Faktura_${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  })

  if (success) {
    // Oppdater faktura status til SENT
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "SENT" }
    })
  }

  return success
}



