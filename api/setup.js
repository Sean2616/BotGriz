import { BOT_COMMANDS } from '../lib/bot.js';
import { getEnvConfig } from '../lib/config.js';
import { setMyCommands, setWebhook } from '../lib/telegram.js';

export default async function handler(req, res) {
  const { webhookSecret } = getEnvConfig();

  if (webhookSecret && req.query?.secret !== webhookSecret) {
    return res.status(401).json({
      ok: false,
      error: 'Secret tidak valid. Tambahkan ?secret=WEBHOOK_SECRET_KAMU di URL.',
    });
  }

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) {
    return res.status(400).json({ ok: false, error: 'Host tidak terdeteksi.' });
  }

  const webhookUrl = `${proto}://${host}/api/webhook`;

  try {
    await setWebhook(webhookUrl, webhookSecret || undefined);
    await setMyCommands(BOT_COMMANDS);

    return res.status(200).json({
      ok: true,
      message: 'Webhook & daftar command bot berhasil didaftarkan!',
      webhookUrl,
    });
  } catch (err) {
    console.error('[Setup Error]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
