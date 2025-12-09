// Email utility for sending notifications
// Configure these environment variables in Vercel:
// - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

interface EmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // For now, just log the email (configure real email service in production)
  console.log("=== EMAIL NOTIFICATION ===")
  console.log("To:", options.to)
  console.log("Subject:", options.subject)
  console.log("Body:", options.html)
  console.log("==========================")
  
  // TODO: Implement actual email sending with nodemailer or a service like SendGrid
  // Example with nodemailer:
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST,
  //   port: parseInt(process.env.SMTP_PORT || "587"),
  //   auth: {
  //     user: process.env.SMTP_USER,
  //     pass: process.env.SMTP_PASS,
  //   },
  // })
  // await transporter.sendMail({
  //   from: process.env.SMTP_FROM,
  //   ...options,
  // })
  
  return true
}

export function getBookingCancelledByAdminEmail(bookingTitle: string, resourceName: string, date: string, time: string, reason?: string) {
  return {
    subject: `Booking kansellert: ${bookingTitle}`,
    html: `
      <h2>Din booking har blitt kansellert</h2>
      <p>Vi må dessverre informere deg om at følgende booking har blitt kansellert av administrator:</p>
      <ul>
        <li><strong>Arrangement:</strong> ${bookingTitle}</li>
        <li><strong>Fasilitet:</strong> ${resourceName}</li>
        <li><strong>Dato:</strong> ${date}</li>
        <li><strong>Tid:</strong> ${time}</li>
      </ul>
      ${reason ? `<p><strong>Årsak:</strong> ${reason}</p>` : ''}
      <p>Ta kontakt hvis du har spørsmål.</p>
      <p>Med vennlig hilsen,<br/>Arena Booking</p>
    `
  }
}

export function getBookingCancelledByUserEmail(bookingTitle: string, resourceName: string, date: string, time: string, userName: string, userEmail: string) {
  return {
    subject: `Booking kansellert av bruker: ${bookingTitle}`,
    html: `
      <h2>En booking har blitt kansellert</h2>
      <p>Følgende booking har blitt kansellert av brukeren:</p>
      <ul>
        <li><strong>Arrangement:</strong> ${bookingTitle}</li>
        <li><strong>Fasilitet:</strong> ${resourceName}</li>
        <li><strong>Dato:</strong> ${date}</li>
        <li><strong>Tid:</strong> ${time}</li>
        <li><strong>Bruker:</strong> ${userName} (${userEmail})</li>
      </ul>
      <p>Med vennlig hilsen,<br/>Arena Booking</p>
    `
  }
}

