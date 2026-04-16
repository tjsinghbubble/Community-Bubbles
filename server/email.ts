import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL] Resend not configured. Verification code for ${to}: ${code}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "Bubble <noreply@bubble.app>",
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

  if (error) {
    console.error(`[EMAIL] Failed to send verification email to ${to}:`, error);
    throw new Error(`Email delivery failed: ${error.message}`);
  }

  console.log(`[EMAIL] Verification code sent to ${to}`);
}
