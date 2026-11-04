import nodemailer from 'nodemailer';

let cachedTransporter;
let cachedConfig;

export const isSmtpConfigured = () => Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD,
);

export const getTransporter = () => {
  if (!isSmtpConfigured()) return null;

  const config = {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
  };

  if (!cachedTransporter || JSON.stringify(config) !== cachedConfig) {
    cachedTransporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.password },
    });
    cachedConfig = JSON.stringify(config);
  }

  return cachedTransporter;
};

export const sendEmail = async ({ to, subject, html }) => {
  const transporter = getTransporter();
  if (!transporter) return { status: 'not_configured', reason: 'SMTP no configurado' };

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });

  return { status: 'sent', to };
};
