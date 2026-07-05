import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const emailService = {
  async sendCriticalStockAlert(medicationName: string, currentStock: number, minQuantity: number, email: string) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('SMTP credentials not configured. Skipping email alert.');
      return;
    }

    try {
      await transporter.sendMail({
        from: `"MedSklad Alert" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `⚠️ КРИТИЧЕСКИЙ ОСТАТОК: ${medicationName}`,
        html: `
          <h3>Внимание!</h3>
          <p>Остаток препарата <strong>${medicationName}</strong> достиг критического уровня.</p>
          <ul>
            <li>Текущий остаток: <strong>${currentStock}</strong></li>
            <li>Минимальный норматив: <strong>${minQuantity}</strong></li>
          </ul>
          <p>Пожалуйста, сформируйте заявку на пополнение запасов.</p>
        `,
      });
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }
};
