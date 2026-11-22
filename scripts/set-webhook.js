import { BOT_COMMANDS } from '../lib/bot.js';
import { getEnvConfig } from '../lib/config.js';
import { setMyCommands, setWebhook } from '../lib/telegram.js';

const baseUrl = process.argv[2]?.replace(/\/+$/, '');
if (!baseUrl) {
  console.error('Cara pakai: node scripts/set-webhook.js https://nama-project.vercel.app');
  process.exit(1);
}

const { webhookSecret } = getEnvConfig();
const webhookUrl = `${baseUrl}/api/webhook`;

try {
  await setWebhook(webhookUrl, webhookSecret || undefined);
  await setMyCommands(BOT_COMMANDS);
  console.log(`✅ Webhook berhasil diset ke: ${webhookUrl}`);
  console.log('✅ Daftar command bot berhasil diperbarui.');
} catch (err) {
  console.error('❌ Gagal mendaftarkan webhook:', err.message);
  process.exit(1);
}
