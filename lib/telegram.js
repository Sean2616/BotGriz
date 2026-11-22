import { getEnvConfig } from './config.js';

async function callTelegram(method, payload) {
  const { botToken } = getEnvConfig();
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN belum diatur di Environment Variables.');
  }

  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    // Abaikan error "message is not modified" saat user klik tombol refresh berulang kali
    if (
      method === 'editMessageText' &&
      typeof data.description === 'string' &&
      data.description.includes('message is not modified')
    ) {
      return data;
    }
    throw new Error(
      `Telegram API ${method} gagal: ${data.description || `HTTP ${res.status}`}`
    );
  }
  return data.result;
}

export function sendMessage(chatId, text, extra = {}) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
}

export function editMessageText(chatId, messageId, text, extra = {}) {
  return callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
}

export function answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  return callTelegram('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

export function setWebhook(url, secretToken) {
  const payload = {
    url,
    allowed_updates: ['message', 'callback_query'],
  };
  if (secretToken) {
    payload.secret_token = secretToken;
  }
  return callTelegram('setWebhook', payload);
}

export function setMyCommands(commands) {
  return callTelegram('setMyCommands', { commands });
}
