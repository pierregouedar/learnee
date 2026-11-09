import nodemailer from "nodemailer";

// Bilan du dimanche (§19.6) : SMTP_URL (ex. smtps://user:pass@smtp.exemple.fr:465) et REPORT_TO dans l'environnement.
export const mailConfigured = () => Boolean(process.env.SMTP_URL && process.env.REPORT_TO);

export async function sendMail({ subject, text }: { subject: string; text: string }) {
  const transport = nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({ from: process.env.SMTP_FROM || process.env.REPORT_TO, to: process.env.REPORT_TO, subject, text });
}
