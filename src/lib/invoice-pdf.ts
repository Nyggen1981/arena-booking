import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { format } from "date-fns"
import { nb } from "date-fns/locale"

interface InvoiceData {
  invoiceNumber: string
  invoiceDate: Date
  dueDate: Date
  organization: {
    name: string
    logo?: string | null
    invoiceAddress?: string | null
    invoicePhone?: string | null
    invoiceEmail?: string | null
    invoiceOrgNumber?: string | null
    invoiceBankAccount?: string | null
    invoiceNotes?: string | null
  }
  billing: {
    name: string
    email: string
    phone?: string | null
    address?: string | null
  }
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  notes?: string | null
}

/**
 * Genererer en PDF-faktura
 */
export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - 2 * margin

  // Colors - defined as tuples for TypeScript spread operator
  const primaryColor: [number, number, number] = [37, 99, 235] // #2563eb
  const darkGray: [number, number, number] = [31, 41, 55]
  const lightGray: [number, number, number] = [107, 114, 128]

  // Header with logo
  let yPos = margin

  // Logo (if available)
  if (data.organization.logo) {
    try {
      // For base64 images
      if (data.organization.logo.startsWith("data:image")) {
        const imgData = data.organization.logo
        doc.addImage(imgData, "PNG", margin, yPos, 40, 15)
      } else {
        // For URL images - would need to fetch and convert to base64
        // For now, skip if it's a URL
      }
    } catch (error) {
      console.error("Error adding logo to PDF:", error)
    }
  }

  // Organization name
  doc.setFontSize(20)
  doc.setTextColor(...primaryColor)
  doc.setFont("helvetica", "bold")
  doc.text(data.organization.name, pageWidth - margin, yPos + 10, {
    align: "right",
  })

  yPos += 25

  // Invoice title and number
  doc.setFontSize(24)
  doc.setTextColor(...darkGray)
  doc.setFont("helvetica", "bold")
  doc.text("FAKTURA", margin, yPos)

  doc.setFontSize(14)
  doc.setTextColor(...lightGray)
  doc.setFont("helvetica", "normal")
  doc.text(`Fakturanummer: ${data.invoiceNumber}`, pageWidth - margin, yPos, {
    align: "right",
  })

  yPos += 15

  // Invoice date and due date
  doc.setFontSize(10)
  doc.setTextColor(...lightGray)
  const invoiceDateStr = format(data.invoiceDate, "d. MMMM yyyy", { locale: nb })
  const dueDateStr = format(data.dueDate, "d. MMMM yyyy", { locale: nb })
  doc.text(`Fakturadato: ${invoiceDateStr}`, margin, yPos)
  doc.text(`Forfallsdato: ${dueDateStr}`, pageWidth - margin, yPos, {
    align: "right",
  })

  yPos += 20

  // Billing information (two columns)
  const col1X = margin
  const col2X = pageWidth / 2 + 10

  // Left column - Bill to
  doc.setFontSize(11)
  doc.setTextColor(...darkGray)
  doc.setFont("helvetica", "bold")
  doc.text("Fakturert til:", col1X, yPos)

  yPos += 7
  doc.setFontSize(10)
  doc.setTextColor(...darkGray)
  doc.setFont("helvetica", "normal")
  doc.text(data.billing.name, col1X, yPos)
  yPos += 5
  if (data.billing.address) {
    doc.text(data.billing.address, col1X, yPos)
    yPos += 5
  }
  doc.text(data.billing.email, col1X, yPos)
  yPos += 5
  if (data.billing.phone) {
    doc.text(data.billing.phone, col1X, yPos)
    yPos += 5
  }

  // Right column - From
  yPos = margin + 50
  doc.setFontSize(11)
  doc.setTextColor(...darkGray)
  doc.setFont("helvetica", "bold")
  doc.text("Fra:", col2X, yPos)

  yPos += 7
  doc.setFontSize(10)
  doc.setTextColor(...darkGray)
  doc.setFont("helvetica", "normal")
  doc.text(data.organization.name, col2X, yPos)
  yPos += 5
  if (data.organization.invoiceAddress) {
    doc.text(data.organization.invoiceAddress, col2X, yPos)
    yPos += 5
  }
  if (data.organization.invoicePhone) {
    doc.text(`Tlf: ${data.organization.invoicePhone}`, col2X, yPos)
    yPos += 5
  }
  if (data.organization.invoiceEmail) {
    doc.text(`E-post: ${data.organization.invoiceEmail}`, col2X, yPos)
    yPos += 5
  }
  if (data.organization.invoiceOrgNumber) {
    doc.text(`Org.nr: ${data.organization.invoiceOrgNumber}`, col2X, yPos)
  }

  // Items table
  yPos = Math.max(yPos, margin + 80) + 15

  autoTable(doc, {
    startY: yPos,
    head: [["Beskrivelse", "Antall", "Pris", "Total"]],
    body: data.items.map((item) => [
      item.description,
      item.quantity.toString(),
      `${item.unitPrice.toFixed(2)} kr`,
      `${item.total.toFixed(2)} kr`,
    ]),
    theme: "striped",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { halign: "center", cellWidth: 30 },
      2: { halign: "right", cellWidth: 40 },
      3: { halign: "right", cellWidth: 40 },
    },
    margin: { left: margin, right: margin },
  })

  // Get final Y position after table
  // autoTable stores the final Y position in doc.lastAutoTable
  const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50

  // Totals
  let totalsY = finalY + 10
  const totalsX = pageWidth - margin - 80

  doc.setFontSize(10)
  doc.setTextColor(...darkGray)
  doc.setFont("helvetica", "normal")
  doc.text("Beløp eks. MVA:", totalsX, totalsY)
  doc.text(`${data.subtotal.toFixed(2)} kr`, pageWidth - margin, totalsY, {
    align: "right",
  })

  totalsY += 7
  doc.text(`MVA (${(data.taxRate * 100).toFixed(0)}%):`, totalsX, totalsY)
  doc.text(`${data.taxAmount.toFixed(2)} kr`, pageWidth - margin, totalsY, {
    align: "right",
  })

  totalsY += 10
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...primaryColor)
  doc.text("Totalt inkl. MVA:", totalsX, totalsY)
  doc.text(`${data.totalAmount.toFixed(2)} kr`, pageWidth - margin, totalsY, {
    align: "right",
  })

  // Payment information
  totalsY += 20
  if (data.organization.invoiceBankAccount) {
    doc.setFontSize(10)
    doc.setTextColor(...darkGray)
    doc.setFont("helvetica", "bold")
    doc.text("Betalingsinformasjon:", margin, totalsY)
    totalsY += 7
    doc.setFont("helvetica", "normal")
    doc.text(`Kontonummer: ${data.organization.invoiceBankAccount}`, margin, totalsY)
    totalsY += 5
    doc.text(`KID: ${data.invoiceNumber}`, margin, totalsY)
    totalsY += 5
    doc.text(`Beløp: ${data.totalAmount.toFixed(2)} kr`, margin, totalsY)
    totalsY += 10
  }

  // Notes
  if (data.notes || data.organization.invoiceNotes) {
    doc.setFontSize(10)
    doc.setTextColor(...lightGray)
    doc.setFont("helvetica", "italic")
    const notes = data.notes || data.organization.invoiceNotes || ""
    const splitNotes = doc.splitTextToSize(notes, contentWidth)
    doc.text(splitNotes, margin, totalsY)
  }

  // Footer
  const footerY = pageHeight - 20
  doc.setFontSize(8)
  doc.setTextColor(...lightGray)
  doc.setFont("helvetica", "normal")
  doc.text(
    `Faktura generert ${format(new Date(), "d. MMMM yyyy 'kl.' HH:mm", {
      locale: nb,
    })}`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  )

  // Convert to buffer
  const pdfOutput = doc.output("arraybuffer")
  return Buffer.from(pdfOutput)
}

