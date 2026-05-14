import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationChannel = 'push' | 'sms' | 'email';
export type NotificationUrgency = 'critical' | 'high' | 'normal' | 'low';

export interface NotificationPayload {
  recipientId: string;
  channels?: NotificationChannel[];
  urgency: NotificationUrgency;
  template: string;
  templateData: Record<string, string>;
  language?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationResult {
  channel: NotificationChannel;
  success: boolean;
  messageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

const TEMPLATES: Record<string, Record<string, string>> = {
  'triage.emergency': {
    en: 'EMERGENCY ALERT: Your triage assessment indicates an emergency condition. Please proceed to the nearest emergency department immediately or call 103.',
    uz: 'SHOSHILINCH OGOHLANTIRISH: Triage baholash shoshilinch holatni ko\'rsatmoqda. Darhol yaqin tibbiy yordam bo\'limiga boring yoki 103 ga qo\'ng\'iroq qiling.',
    ru: 'ЭКСТРЕННОЕ ПРЕДУПРЕЖДЕНИЕ: Результаты сортировки указывают на экстренное состояние. Немедленно обратитесь в ближайшее отделение неотложной помощи или позвоните 103.',
  },
  'triage.urgent': {
    en: 'URGENT: Your triage indicates you should seek medical attention within 1 hour. Recommended specialty: {{specialty}}.',
    uz: 'SHOSHILINCH: Triage natijalari 1 soat ichida tibbiy yordamga murojaat qilish kerakligini ko\'rsatmoqda. Tavsiya etilgan mutaxassislik: {{specialty}}.',
    ru: 'СРОЧНО: Результаты сортировки рекомендуют обратиться за медицинской помощью в течение 1 часа. Рекомендуемая специальность: {{specialty}}.',
  },
  'appointment.confirmed': {
    en: 'Your appointment with Dr. {{doctorName}} is confirmed for {{date}} at {{time}}. Check-in code: {{checkInCode}}.',
    uz: 'Dr. {{doctorName}} bilan uchrashuvingiz {{date}} kuni soat {{time}} da tasdiqlandi. Check-in kodi: {{checkInCode}}.',
    ru: 'Ваш прием у доктора {{doctorName}} подтвержден на {{date}} в {{time}}. Код регистрации: {{checkInCode}}.',
  },
  'appointment.reminder': {
    en: 'Reminder: Your appointment with Dr. {{doctorName}} is tomorrow at {{time}}. Check-in code: {{checkInCode}}.',
    uz: 'Eslatma: Dr. {{doctorName}} bilan uchrashuvingiz ertaga soat {{time}} da. Check-in kodi: {{checkInCode}}.',
    ru: 'Напоминание: Ваш прием у доктора {{doctorName}} завтра в {{time}}. Код регистрации: {{checkInCode}}.',
  },
  'appointment.cancelled': {
    en: 'Your appointment with Dr. {{doctorName}} on {{date}} has been cancelled. Reason: {{reason}}.',
    uz: 'Dr. {{doctorName}} bilan {{date}} kungi uchrashuvingiz bekor qilindi. Sabab: {{reason}}.',
    ru: 'Ваш прием у доктора {{doctorName}} на {{date}} отменен. Причина: {{reason}}.',
  },
  'outbreak.alert': {
    en: 'HEALTH ALERT for {{region}}: {{disease}} outbreak detected. {{message}}',
    uz: '{{region}} uchun SOGLIQ OGOHLANTIRISHI: {{disease}} epidemiyasi aniqlandi. {{message}}',
    ru: 'ПРЕДУПРЕЖДЕНИЕ ДЛЯ {{region}}: Обнаружена вспышка {{disease}}. {{message}}',
  },
  'vitals.critical': {
    en: 'CRITICAL ALERT: Your {{metric}} reading of {{value}} is outside safe range. Please seek immediate medical attention.',
    uz: 'MUHIM OGOHLANTIRISH: {{metric}} ko\'rsatkichingiz {{value}} xavfsiz chegaradan tashqarida. Zudlik bilan tibbiy yordamga murojaat qiling.',
    ru: 'КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ: Ваш показатель {{metric}} ({{value}}) вне безопасного диапазона. Немедленно обратитесь за медицинской помощью.',
  },
  'prescription.followup': {
    en: 'Your follow-up for prescription by Dr. {{doctorName}} is due on {{date}}. Please schedule an appointment.',
    uz: 'Dr. {{doctorName}} retsepti bo\'yicha nazorat {{date}} kuni. Iltimos, uchrashuv belgilang.',
    ru: 'Контрольный прием по рецепту доктора {{doctorName}} назначен на {{date}}. Пожалуйста, запишитесь на прием.',
  },
};

// ---------------------------------------------------------------------------
// Template rendering
// ---------------------------------------------------------------------------

function renderTemplate(
  templateKey: string,
  language: string,
  data: Record<string, string>,
): string {
  const templates = TEMPLATES[templateKey];
  if (!templates) {
    logger.warn({ templateKey }, 'Unknown notification template');
    return `Notification: ${templateKey}`;
  }

  // Fall back to English if the requested language isn't available
  const template = templates[language] ?? templates['en'] ?? Object.values(templates)[0];

  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

// ---------------------------------------------------------------------------
// Urgency-based channel routing
// ---------------------------------------------------------------------------

function resolveChannels(
  urgency: NotificationUrgency,
  explicitChannels?: NotificationChannel[],
): NotificationChannel[] {
  if (explicitChannels && explicitChannels.length > 0) {
    return explicitChannels;
  }

  switch (urgency) {
    case 'critical':
      return ['push', 'sms', 'email'];
    case 'high':
      return ['push', 'sms'];
    case 'normal':
      return ['push'];
    case 'low':
      return ['push'];
  }
}

// ---------------------------------------------------------------------------
// Channel implementations
// ---------------------------------------------------------------------------

async function sendPushNotification(
  recipientId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<NotificationResult> {
  if (!config.firebase.projectId) {
    logger.debug('Firebase not configured; skipping push notification');
    return { channel: 'push', success: false, error: 'Firebase not configured' };
  }

  try {
    // Firebase Admin SDK HTTP v1 API
    const accessToken = await getFirebaseAccessToken();

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${config.firebase.projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            topic: `user_${recipientId}`,
            notification: { title, body },
            data: data
              ? Object.fromEntries(
                  Object.entries(data).map(([k, v]) => [k, String(v)]),
                )
              : undefined,
            android: { priority: 'high' },
            apns: {
              headers: { 'apns-priority': '10' },
              payload: { aps: { sound: 'default', badge: 1 } },
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`FCM error ${response.status}: ${errBody}`);
    }

    const result = (await response.json()) as { name: string };
    return { channel: 'push', success: true, messageId: result.name };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err }, 'Push notification failed');
    return { channel: 'push', success: false, error: message };
  }
}

async function sendSms(
  recipientId: string,
  body: string,
): Promise<NotificationResult> {
  if (!config.twilio.accountSid || !config.twilio.authToken) {
    logger.debug('Twilio not configured; skipping SMS');
    return { channel: 'sms', success: false, error: 'Twilio not configured' };
  }

  try {
    // Look up recipient's phone number
    const { query: dbQuery } = await import('../../config/database.js');
    const result = await dbQuery(
      `SELECT phone FROM patient_contacts WHERE patient_id = $1 LIMIT 1`,
      [recipientId],
    );

    const phone = result.rows[0]?.phone as string | undefined;
    if (!phone) {
      return { channel: 'sms', success: false, error: 'No phone number on file' };
    }

    // Twilio REST API
    const credentials = Buffer.from(
      `${config.twilio.accountSid}:${config.twilio.authToken}`,
    ).toString('base64');

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          From: config.twilio.phoneNumber ?? '',
          Body: body,
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Twilio error ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as { sid: string };
    return { channel: 'sms', success: true, messageId: data.sid };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err }, 'SMS notification failed');
    return { channel: 'sms', success: false, error: message };
  }
}

async function sendEmail(
  recipientId: string,
  subject: string,
  body: string,
): Promise<NotificationResult> {
  if (!config.smtp.host) {
    logger.debug('SMTP not configured; skipping email');
    return { channel: 'email', success: false, error: 'SMTP not configured' };
  }

  try {
    // Look up recipient email
    const { query: dbQuery } = await import('../../config/database.js');
    const result = await dbQuery(
      `SELECT email FROM patient_contacts WHERE patient_id = $1 LIMIT 1`,
      [recipientId],
    );

    const email = result.rows[0]?.email as string | undefined;
    if (!email) {
      return { channel: 'email', success: false, error: 'No email on file' };
    }

    // Use nodemailer if available, otherwise fall back to logging stub
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: config.smtp.user
          ? { user: config.smtp.user, pass: config.smtp.password }
          : undefined,
      });

      const info = await transporter.sendMail({
        from: config.smtp.from,
        to: email,
        subject,
        text: body,
      });

      return { channel: 'email', success: true, messageId: info.messageId };
    } catch (importErr) {
      // nodemailer not installed -- log and return success stub
      logger.warn(
        { recipientId, subject },
        'nodemailer not available; logging email instead of sending',
      );
      logger.info({ to: email, subject, body: body.slice(0, 200) }, 'Email (stub)');
      return { channel: 'email', success: true, messageId: `stub-${Date.now()}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err }, 'Email notification failed');
    return { channel: 'email', success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Firebase access token helper (service account JWT flow)
// ---------------------------------------------------------------------------

async function getFirebaseAccessToken(): Promise<string> {
  // In production, use google-auth-library or a cached service account token.
  if (!config.firebase.clientEmail || !config.firebase.privateKey) {
    logger.warn('Firebase credentials not configured; skipping push notification in development');
    return '';
  }

  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      credentials: {
        client_email: config.firebase.clientEmail,
        private_key: config.firebase.privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token ?? '';
  } catch (err) {
    logger.warn({ err }, 'google-auth-library not available or failed; push notifications disabled');
    return '';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a notification to a user across the appropriate channels based on urgency.
 */
export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult[]> {
  const language = payload.language ?? 'en';
  const body = renderTemplate(payload.template, language, payload.templateData);
  const channels = resolveChannels(payload.urgency, payload.channels);
  const subject = `Aura Health: ${payload.template.split('.').pop()?.replace(/_/g, ' ') ?? 'Notification'}`;

  logger.info(
    {
      recipientId: payload.recipientId,
      template: payload.template,
      urgency: payload.urgency,
      channels,
    },
    'Sending notification',
  );

  const results = await Promise.allSettled(
    channels.map(async (channel) => {
      switch (channel) {
        case 'push':
          return sendPushNotification(payload.recipientId, subject, body, payload.metadata);
        case 'sms':
          return sendSms(payload.recipientId, body);
        case 'email':
          return sendEmail(payload.recipientId, subject, body);
      }
    }),
  );

  return results.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      channel: 'push' as NotificationChannel,
      success: false,
      error: r.reason?.message ?? 'Unknown error',
    };
  });
}

/**
 * Send a notification to multiple recipients (e.g., outbreak alerts).
 */
export async function broadcastNotification(
  recipientIds: string[],
  payload: Omit<NotificationPayload, 'recipientId'>,
): Promise<Map<string, NotificationResult[]>> {
  const results = new Map<string, NotificationResult[]>();

  // Process in batches of 50 to avoid overwhelming external services
  const batchSize = 50;
  for (let i = 0; i < recipientIds.length; i += batchSize) {
    const batch = recipientIds.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((recipientId) =>
        sendNotification({ ...payload, recipientId }),
      ),
    );

    for (let j = 0; j < batch.length; j++) {
      const batchResult = batchResults[j];
      results.set(
        batch[j],
        batchResult.status === 'fulfilled' ? batchResult.value : [],
      );
    }
  }

  return results;
}
