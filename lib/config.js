export const POPULAR_SERVICES = [
  { code: 'wa', name: 'WhatsApp', emoji: '💬' },
  { code: 'tg', name: 'Telegram', emoji: '✈️' },
  { code: 'go', name: 'Google / Gmail', emoji: '🔍' },
  { code: 'fb', name: 'Facebook', emoji: '📘' },
  { code: 'ig', name: 'Instagram', emoji: '📸' },
  { code: 'lf', name: 'TikTok', emoji: '🎵' },
  { code: 'tw', name: 'X / Twitter', emoji: '🐦' },
  { code: 'ka', name: 'Shopee', emoji: '🛒' },
  { code: 'ds', name: 'Discord', emoji: '🎮' },
  { code: 'dr', name: 'OpenAI / ChatGPT', emoji: '🤖' },
  { code: 'mm', name: 'Microsoft', emoji: '🪟' },
  { code: 'wx', name: 'Apple', emoji: '🍎' },
];

export const POPULAR_COUNTRIES = [
  { id: '6', name: 'Indonesia', flag: '🇮🇩' },
  { id: '187', name: 'USA', flag: '🇺🇸' },
  { id: '7', name: 'Malaysia', flag: '🇲🇾' },
  { id: '4', name: 'Philippines', flag: '🇵🇭' },
  { id: '10', name: 'Vietnam', flag: '🇻🇳' },
  { id: '52', name: 'Thailand', flag: '🇹🇭' },
  { id: '22', name: 'India', flag: '🇮🇳' },
  { id: '16', name: 'UK', flag: '🇬🇧' },
  { id: '73', name: 'Brazil', flag: '🇧🇷' },
  { id: '0', name: 'Russia', flag: '🇷🇺' },
];

export function getServiceLabel(code) {
  const found = POPULAR_SERVICES.find((s) => s.code === String(code).toLowerCase());
  return found ? `${found.emoji} ${found.name} (${found.code})` : `📦 ${code}`;
}

export function getCountryLabel(id) {
  const found = POPULAR_COUNTRIES.find((c) => c.id === String(id));
  return found ? `${found.flag} ${found.name} (${found.id})` : `🌍 Negara #${id}`;
}

export function getEnvConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const grizzlyApiKey = process.env.GRIZZLY_API_KEY?.trim();
  const webhookSecret = process.env.WEBHOOK_SECRET?.trim() || '';
  const grizzlyBaseUrl =
    process.env.GRIZZLY_API_BASE_URL?.trim() ||
    'https://api.grizzlysms.com/stubs/handler_api.php';

  const allowedUserIds = (process.env.ALLOWED_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return {
    botToken,
    grizzlyApiKey,
    webhookSecret,
    grizzlyBaseUrl,
    allowedUserIds,
  };
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
