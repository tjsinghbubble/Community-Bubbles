import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`[EMAIL] Gmail not configured. Verification code for ${to}: ${code}`);
    return;
  }

  await transporter.sendMail({
    from: `"Bubble" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Your Bubble Verification Code",
    html: `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #FAFAFA;">
        <div style="background: #FFFFFF; border-radius: 16px; padding: 32px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h1 style="color: #35A8F7; font-size: 28px; margin: 0 0 8px;">Bubble</h1>
          <p style="color: #4D4D4D; font-size: 16px; margin: 0 0 24px;">Here's your verification code</p>
          <div style="background: #F5F6F8; border-radius: 12px; padding: 20px; margin: 0 0 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1E1F26;">${code}</span>
          </div>
          <p style="color: #969696; font-size: 14px; margin: 0;">This code expires in 30 minutes.</p>
        </div>
      </div>
    `,
  });

  console.log(`[EMAIL] Verification code sent to ${to}`);
}
