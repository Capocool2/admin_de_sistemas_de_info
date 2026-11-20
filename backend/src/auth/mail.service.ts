// backend/src/auth/mail.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly isConfigured: boolean;

  constructor() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const rawPass = process.env.SMTP_PASS || '';
    const pass = rawPass.replace(/\s+/g, '');

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass },
        });
        this.isConfigured = true;
        this.logger.log(`📧 Servicio Nodemailer configurado con SMTP: ${host}:${port} (${user})`);
      } catch (err) {
        this.logger.warn(`No se pudo inicializar transporte SMTP: ${err.message}. Se usará fallback de consola.`);
        this.isConfigured = false;
      }
    } else {
      this.isConfigured = false;
      this.logger.log('📧 Variables SMTP no configuradas. Fallback activo: códigos impresos en consola.');
    }
  }

  /**
   * Envía el código de verificación por correo electrónico (Nodemailer)
   * o lo imprime en consola si las credenciales SMTP no están definidas.
   */
  async sendVerificationCode(correo: string, codigo: string, nombre?: string): Promise<boolean> {
    const recipientName = nombre || 'Turista SAME';

    // Banner destacado siempre visible en consola para pruebas ágiles locales
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log('║        ⚡ SAME - SISTEMA DE MONOPATINES ELÉCTRICOS ⚡          ║');
    console.log('║               CÓDIGO DE VERIFICACIÓN DE EMAIL                ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ Destinatario : ${correo.padEnd(46)} ║`);
    console.log(`║ Nombre       : ${recipientName.padEnd(46)} ║`);
    console.log(`║ Código (OTP) : [  \x1b[1m\x1b[32m${codigo}\x1b[0m  ]                                    ║`);
    console.log('║ Expiración   : 15 minutos                                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝\n');

    if (!this.isConfigured || !this.transporter) {
      this.logger.log(`[FALLBACK LOCAL] Código para ${correo}: ${codigo} (SMTP no configurado)`);
      return true;
    }

    try {
      const configuredFrom = process.env.SMTP_FROM || '';
      const fromSender = configuredFrom && !configuredFrom.includes('no-reply@same.com')
        ? configuredFrom
        : `"SAME Malecón" <${process.env.SMTP_USER}>`;

      await this.transporter.sendMail({
        from: fromSender,
        to: correo,
        subject: `Código de Verificación SAME: ${codigo}`,
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 500px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #10b981; margin: 0; font-size: 24px;">⚡ SAME Malecón</h1>
              <p style="color: #94a3b8; font-size: 13px; margin: 4px 0 0;">Gran Malecón del Río • Barranquilla</p>
            </div>
            <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
              <p style="margin: 0 0 12px; font-size: 15px;">Hola <strong>${recipientName}</strong>,</p>
              <p style="margin: 0 0 16px; font-size: 14px; color: #cbd5e1;">Usa el siguiente código de 6 dígitos para validar tu correo electrónico y activar tu cuenta de turista en SAME:</p>
              <div style="text-align: center; margin: 24px 0;">
                <span style="display: inline-block; background-color: #10b981; color: #022c22; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 12px 24px; border-radius: 8px;">
                  ${codigo}
                </span>
              </div>
              <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">Este código expira en 15 minutos.</p>
            </div>
            <p style="font-size: 11px; color: #64748b; text-align: center; margin-top: 20px;">Si no solicitaste este registro en SAME Malecón, puedes ignorar este mensaje.</p>
          </div>
        `,
      });
      this.logger.log(`Correo de verificación enviado a ${correo}`);
      return true;
    } catch (err) {
      this.logger.error(`Error enviando correo SMTP a ${correo}: ${err.message}`);
      return false;
    }
  }
}
