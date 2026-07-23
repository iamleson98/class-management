import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
})

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP not configured, skipping email send')
    console.log(`[Email] Would send to: ${to}, subject: ${subject}`)
    return
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Việt Mỹ Global" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    console.log(`[Email] Sent to ${to}: ${subject}`)
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}:`, error)
    throw error
  }
}
