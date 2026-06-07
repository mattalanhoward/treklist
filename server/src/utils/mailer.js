const nodemailer = require("nodemailer");
const { buildWelcomeEmail } = require("./welcomeEmailTemplate");
const { buildNotificationEmail } = require("./notificationEmailTemplate");

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  const secure =
    process.env.SMTP_SECURE != null
      ? String(process.env.SMTP_SECURE) === "true"
      : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

async function sendSupportEmail({ to, subject, text, html, from }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[mailer] SMTP not configured — skipping email send.");
    return { skipped: true };
  }

  const finalFrom = from || process.env.SMTP_FROM || process.env.SMTP_USER;

  const info = await transporter.sendMail({
    from: finalFrom,
    to,
    subject,
    text,
    html,
  });

  return { skipped: false, messageId: info.messageId };
}

async function sendWelcomeEmail({ to, trailname, listUrl, unsubscribeUrl }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[mailer] SMTP not configured — skipping welcome email.");
    return { skipped: true };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const { html, text } = buildWelcomeEmail({ trailname, listUrl, unsubscribeUrl });

  const info = await transporter.sendMail({
    from,
    to,
    subject: "Your TrekList is ready — add your first item",
    text,
    html,
  });

  return { skipped: false, messageId: info.messageId };
}

async function sendNotificationEmail({ to, recipientTrailname, senderTrailname, type, replyBody, postTitle, postUrl, unsubscribeUrl }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[mailer] SMTP not configured — skipping notification email.");
    return { skipped: true };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const { html, text, subject } = buildNotificationEmail({
    recipientTrailname,
    senderTrailname,
    type,
    replyBody,
    postTitle,
    postUrl,
    unsubscribeUrl,
  });

  const info = await transporter.sendMail({ from, to, subject, text, html });
  return { skipped: false, messageId: info.messageId };
}

module.exports = { sendSupportEmail, sendWelcomeEmail, sendNotificationEmail };
