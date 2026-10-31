import nodemailer from 'nodemailer';

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = (async () => {
    // In test environment, use instantaneous in-memory transport
    if (process.env.NODE_ENV === 'test') {
      return nodemailer.createTransport({
        jsonTransport: true,
      });
    }

    const smtpHost = process.env.SMTP_HOST || 'smtp.ethereal.email';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpUser && smtpPass) {
      return nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    }

    // Dev fallback: generate Ethereal test account automatically
    try {
      const testAccount = await nodemailer.createTestAccount();
      console.log(`[Mailer] Created Ethereal test account: ${testAccount.user}`);
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch {
      return nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  })();

  return transporterPromise;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendMailOptions) {
  const transporter = await getTransporter();
  const from = process.env.MAIL_FROM || 'RevenIQ <no-reply@reveniq.test>';

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ''),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`[Mailer] Password reset preview URL: ${previewUrl}`);
  }

  return { messageId: info.messageId, previewUrl };
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const resetLink = `${clientUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FAF9F5; margin: 0; padding: 40px 20px; color: #1F291E; }
          .container { max-width: 560px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #EBE8DF; padding: 36px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
          .logo { font-size: 24px; font-weight: 700; color: #4B6032; margin-bottom: 24px; letter-spacing: -0.5px; }
          h1 { font-size: 20px; font-weight: 600; color: #1F291E; margin-bottom: 16px; }
          p { font-size: 15px; line-height: 1.6; color: #586852; margin-bottom: 24px; }
          .btn { display: inline-block; background-color: #556B2F; color: #FFFFFF !important; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 8px; margin-bottom: 24px; }
          .note { font-size: 13px; color: #82917C; border-top: 1px solid #F0EEE6; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">RevenIQ</div>
          <h1>Reset your password</h1>
          <p>We received a request to reset your password. Click the button below to choose a new password. This link is valid for 1 hour.</p>
          <a href="${resetLink}" class="btn" target="_blank">Reset Password</a>
          <p class="note">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Reset your RevenIQ password',
    html,
  });
}
