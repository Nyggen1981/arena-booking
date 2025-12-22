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
  let logoHeight = 0

  // Logo (if available) - maintain aspect ratio, place on right side
  if (data.organization.logo) {
    try {
      // For base64 images
      if (data.organization.logo.startsWith("data:image")) {
        const imgData = data.organization.logo
        // Extract image format from data URL
        const format = imgData.includes("image/png") ? "PNG" : 
                      imgData.includes("image/jpeg") || imgData.includes("image/jpg") ? "JPEG" : "PNG"
        
        // Get image dimensions from base64 data
        // Extract base64 string (remove data:image/...;base64, prefix)
        const base64Data = imgData.split(",")[1]
        const buffer = Buffer.from(base64Data, "base64")
        
        // For PNG: read dimensions from IHDR chunk
        // For JPEG: read dimensions from SOF marker
        let width = 0
        let height = 0
        
        if (format === "PNG") {
          // PNG: width and height are at bytes 16-23 in IHDR chunk
          width = buffer.readUInt32BE(16)
          height = buffer.readUInt32BE(20)
        } else if (format === "JPEG") {
          // JPEG: find SOF marker (0xFFC0, 0xFFC1, or 0xFFC2) and read dimensions
          let i = 0
          while (i < buffer.length - 1) {
            if (buffer[i] === 0xFF && (buffer[i + 1] === 0xC0 || buffer[i + 1] === 0xC1 || buffer[i + 1] === 0xC2)) {
              height = buffer.readUInt16BE(i + 5)
              width = buffer.readUInt16BE(i + 7)
              break
            }
            i++
          }
        }
        
        // If we couldn't read dimensions, use default aspect ratio
        if (width === 0 || height === 0) {
          width = 200
          height = 100
        }
        
        // Calculate dimensions maintaining aspect ratio
        const maxWidth = 30 // mm
        const maxHeight = 20 // mm
        const aspectRatio = width / height
        
        let logoWidth = maxWidth
        logoHeight = maxWidth / aspectRatio
        
        // If height exceeds max, scale down
        if (logoHeight > maxHeight) {
          logoHeight = maxHeight
          logoWidth = maxHeight * aspectRatio
        }
        
        // Place logo on the right side, aligned with top
        doc.addImage(imgData, format, pageWidth - margin - logoWidth, yPos, logoWidth, logoHeight, undefined, "FAST")
      } else {
        // For URL images - would need to fetch and convert to base64
        // For now, skip if it's a URL
      }
    } catch (error) {
      console.error("Error adding logo to PDF:", error)
    }
  }

  // Organization name - on right side, below logo if present
  const orgNameY = data.organization.logo ? yPos + logoHeight + 5 : yPos + 10
  doc.setFontSize(20)
  doc.setTextColor(...primaryColor)
  doc.setFont("helvetica", "bold")
  doc.text(data.organization.name, pageWidth - margin, orgNameY, {
    align: "right",
  })

  // Invoice title and number - on left side
  yPos = margin + 5
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
    body: data.items.map((item) => {
      // Clean description - remove all & characters that are not part of valid HTML entities
      // First decode valid HTML entities, then remove all & characters
      let cleanDescription = item.description
        // Decode numeric entities like &#106; (j), &#103; (g), etc.
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)))
        // Decode hex entities like &#x6A; (j)
        .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        // Then decode named entities
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        // Remove any remaining HTML entities
        .replace(/&[#\w]+;/g, "")
        // Remove ALL standalone & characters (they seem to be encoding artifacts)
        .replace(/&/g, "")
      
      return [
        cleanDescription,
        item.quantity.toString(),
        `${item.unitPrice.toFixed(2)} kr`,
        `${item.total.toFixed(2)} kr`,
      ]
    }),
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

