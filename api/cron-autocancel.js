import { processActiveOrders } from '../lib/bot.js';
import { getEnvConfig } from '../lib/config.js';

export default async function handler(req, res) {
  const { webhookSecret } = getEnvConfig();
  const cronSecret = process.env.CRON_SECRET?.trim() || '';

  // Dukung autentikasi via ?secret=WEBHOOK_SECRET atau header Authorization: Bearer <CRON_SECRET|WEBHOOK_SECRET>
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const querySecret = String(req.query?.secret || '').trim();

  const expectedSecrets = [webhookSecret, cronSecret].filter(Boolean);
  if (expectedSecrets.length > 0) {
    const authorized =
      expectedSecrets.includes(querySecret) || expectedSecrets.includes(bearerToken);
    if (!authorized) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
  }

  try {
    const result = await processActiveOrders();
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Cron AutoCancel Error]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
