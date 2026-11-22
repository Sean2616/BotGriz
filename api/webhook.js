import { handleUpdate } from '../lib/bot.js';
import { getEnvConfig } from '../lib/config.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'grizzlysms-telegram-bot',
      status: 'running',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  const { webhookSecret } = getEnvConfig();
  if (webhookSecret) {
    const incomingSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (incomingSecret !== webhookSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  try {
    const update = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    await handleUpdate(update);
  } catch (err) {
    console.error('[Webhook Error]', err);
  }

  // Selalu balas 200 ke Telegram agar update tidak di-retry terus-menerus
  return res.status(200).json({ ok: true });
}
