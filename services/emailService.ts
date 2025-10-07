import nodemailer from 'nodemailer';
import { createErrorResponse } from '../utils/errorHandler';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter;

  private constructor() {
    // Create transporter with SMTP configuration from environment variables
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // Verify transporter configuration
      await this.transporter.verify();
      
      // Send email
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || `"Docapture" <admin@docapture.com>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      console.log('Email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendVerificationEmail(email: string, verificationToken: string): Promise<boolean> {
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/verify?token=${verificationToken}`;
    
    const text = `Please verify your email by clicking the following link: ${verificationUrl}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Verify your email address</h2>
        <p>Hello,</p>
        <p>Thank you for registering with Docapture. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #fbbf24; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 4px; display: inline-block;
                    font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p>If you didn't create an account with Docapture, you can safely ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          This email was sent to ${email}. If you have any questions, please contact our support team.
        </p>
      </div>
    `;

    return await this.sendEmail({
      to: email,
      subject: 'Verify your Docapture account',
      text,
      html,
    });
  }
}

export default EmailService.getInstance();