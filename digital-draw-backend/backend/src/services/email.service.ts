import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const from = `Digital Draw System <${process.env.EMAIL_FROM || 'noreply@digitaldraw.com'}>`;

export const sendVerificationEmail = async (
  to: string,
  name: string,
  token: string
): Promise<void> => {
  const url = `${process.env.FRONTEND_URL}/auth/verify-email?token=${token}`;
  await transporter.sendMail({
    from,
    to,
    subject: 'Verify your email – Digital Draw System',
    html: `
      <h2>Welcome, ${name}!</h2>
      <p>Please verify your email address to activate your account.</p>
      <a href="${url}" style="background:#06b6d4;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
        Verify Email
      </a>
      <p>This link expires in 24 hours.</p>
      <p>If you did not create an account, ignore this email.</p>
    `,
  });
};

export const sendPasswordResetEmail = async (
  to: string,
  name: string,
  token: string
): Promise<void> => {
  const url = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;
  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your password – Digital Draw System',
    html: `
      <h2>Password Reset Request</h2>
      <p>Hi ${name}, you requested a password reset.</p>
      <a href="${url}" style="background:#06b6d4;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
        Reset Password
      </a>
      <p>This link expires in 1 hour. If you did not request this, ignore it.</p>
    `,
  });
};

export const sendWinnerNotification = async (
  to: string,
  name: string,
  drawTitle: string,
  prizeTitle: string,
  verificationCode: string,
  claimDeadline: Date
): Promise<void> => {
  await transporter.sendMail({
    from,
    to,
    subject: `Congratulations! You won in ${drawTitle}`,
    html: `
      <h2>You're a Winner!</h2>
      <p>Hi ${name}, congratulations! You have been selected as a winner in <strong>${drawTitle}</strong>.</p>
      <p><strong>Prize:</strong> ${prizeTitle}</p>
      <p><strong>Verification Code:</strong> <code style="font-size:1.5em;letter-spacing:4px;">${verificationCode}</code></p>
      <p><strong>Claim Deadline:</strong> ${claimDeadline.toLocaleDateString()}</p>
      <p>Log in to your account to claim your prize before the deadline.</p>
    `,
  });
};

export const sendDrawOpenNotification = async (
  to: string,
  name: string,
  drawTitle: string,
  drawDate: Date
): Promise<void> => {
  await transporter.sendMail({
    from,
    to,
    subject: `New Draw Open: ${drawTitle}`,
    html: `
      <h2>New Draw Available</h2>
      <p>Hi ${name}, a new draw is now open for entries.</p>
      <p><strong>Draw:</strong> ${drawTitle}</p>
      <p><strong>Draw Date:</strong> ${drawDate.toLocaleDateString()}</p>
      <a href="${process.env.FRONTEND_URL}/dashboard/participant/draws"
         style="background:#06b6d4;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
        Enter Now
      </a>
    `,
  });
};
