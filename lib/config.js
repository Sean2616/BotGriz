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

export const FALLBACK_OPERATORS_BY_COUNTRY = {
  '6': ['telkomsel', 'indosat', 'axis', 'xl', 'three', 'smartfren'],
  '187': ['tmobile', 'att', 'verizon', 'sprint', 'lycamobile'],
  '7': ['celcom', 'digi', 'maxis', 'umobile', 'tunetalk'],
  '4': ['globe', 'smart', 'sun', 'tm'],
  '10': ['viettel', 'mobifone', 'vinaphone', 'vietnamobile'],
  '52': ['ais', 'dtac', 'truemove'],
  '22': ['airtel', 'jio', 'vi', 'bsnl'],
  '16': ['ee', 'o2', 'vodafone', 'three', 'lycamobile'],
  '73': ['vivo', 'claro', 'tim', 'oi'],
  '0': ['mts', 'beeline', 'megafon', 'tele2', 'yota', 'tinkoff'],
};

export function getOperatorLabel(operator) {
  if (!operator || operator === 'any') return '🎲 Any (Otomatis)';
  return `📡 ${String(operator)}`;
}

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

  const autoCancelSeconds = Math.max(
    60,
    Number.parseInt(process.env.AUTO_CANCEL_SECONDS || '310', 10) || 310
  );

  const maxOrderQty = Math.min(
    20,
    Math.max(1, Number.parseInt(process.env.MAX_ORDER_QTY || '10', 10) || 10)
  );

  const redisUrl = (
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    ''
  ).trim();
  const redisToken = (
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    ''
  ).trim();

  return {
    botToken,
    grizzlyApiKey,
    webhookSecret,
    grizzlyBaseUrl,
    allowedUserIds,
    autoCancelSeconds,
    maxOrderQty,
    redisUrl,
    redisToken,
  };
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
