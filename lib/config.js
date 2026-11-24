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
  { code: 'fr', name: 'Dana', emoji: '💵' },
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

const ID_OPERATOR_PREFIXES = [
  {
    code: 'telkomsel',
    name: 'Telkomsel',
    prefixes: ['62811', '62812', '62813', '62821', '62822', '62823', '62851', '62852', '62853'],
  },
  {
    code: 'indosat',
    name: 'Indosat',
    prefixes: ['62814', '62815', '62816', '62855', '62856', '62857', '62858'],
  },
  {
    code: 'xl',
    name: 'XL Axiata',
    prefixes: ['62817', '62818', '62819', '62859', '62877', '62878', '62879'],
  },
  {
    code: 'axis',
    name: 'Axis',
    prefixes: ['62831', '62832', '62833', '62838'],
  },
  {
    code: 'three',
    name: 'Three (3)',
    prefixes: ['62895', '62896', '62897', '62898', '62899'],
  },
  {
    code: 'smartfren',
    name: 'Smartfren',
    prefixes: ['62881', '62882', '62883', '62884', '62885', '62886', '62887', '62888', '62889'],
  },
];

export const INDONESIA_PHONE_EXCEPTIONS = {
  telkomsel:
    '6283,6287,6288,6289,62814,62815,62816,62817,62818,62819,62855,62856,62857,62858,62859',
  indosat:
    '6282,6283,6287,6288,6289,62811,62812,62813,62817,62818,62819,62851,62852,62853,62859',
  xl: '6282,6283,6288,6289,62811,62812,62813,62814,62815,62816,62851,62852,62853,62855,62856,62857,62858',
  axis: '6281,6282,6285,6287,6288,6289',
  three: '6281,6282,6283,6285,6287,6288',
  smartfren: '6281,6282,6283,6285,6287,6289',
};

const OPERATOR_ALIASES = {
  tsel: 'telkomsel',
  isat: 'indosat',
  tri: 'three',
  smart: 'smartfren',
};

export function normalizeOperatorCode(operator) {
  const lower = String(operator || '').trim().toLowerCase();
  if (!lower || lower === 'any') return 'any';
  return OPERATOR_ALIASES[lower] || lower;
}

export function getIndonesiaPhoneException(country, operator) {
  if (String(country) !== '6') return '';
  const normalized = normalizeOperatorCode(operator);
  return INDONESIA_PHONE_EXCEPTIONS[normalized] || '';
}

export function detectIndonesiaOperator(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith('08')) {
    normalized = `62${normalized.slice(1)}`;
  } else if (normalized.startsWith('8')) {
    normalized = `62${normalized}`;
  }

  if (!normalized.startsWith('628')) return null;

  const prefix5 = normalized.slice(0, 5);
  const found = ID_OPERATOR_PREFIXES.find((op) => op.prefixes.includes(prefix5));
  return found ? { code: found.code, name: found.name } : null;
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

  const notifyChatId = (process.env.NOTIFY_CHAT_ID || allowedUserIds[0] || '').trim();
  const defaultProviderIds = (process.env.GRIZZLY_PROVIDER_IDS || '').trim();
  const defaultExceptProviderIds = (process.env.GRIZZLY_EXCEPT_PROVIDER_IDS || '').trim();

  return {
    botToken,
    grizzlyApiKey,
    webhookSecret,
    grizzlyBaseUrl,
    allowedUserIds,
    autoCancelSeconds,
    maxOrderQty,
    notifyChatId,
    defaultProviderIds,
    defaultExceptProviderIds,
  };
}

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
