import {
  FALLBACK_OPERATORS_BY_COUNTRY,
  POPULAR_COUNTRIES,
  POPULAR_SERVICES,
  escapeHtml,
  getCountryLabel,
  getEnvConfig,
  getOperatorLabel,
  getServiceLabel,
} from './config.js';
import * as grizzly from './grizzly.js';
import * as tg from './telegram.js';

export const BOT_COMMANDS = [
  { command: 'start', description: 'Buka menu utama bot GrizzlySMS' },
  { command: 'balance', description: 'Cek saldo akun GrizzlySMS' },
  { command: 'order', description: 'Order 1 atau banyak: /order <svc> <cty> [op] [qty] [maxPrice]' },
  { command: 'active', description: 'Lihat daftar order aktif & sisa waktu auto-cancel' },
  { command: 'operators', description: 'Lihat daftar operator: /operators <country>' },
  { command: 'price', description: 'Cek harga & stok: /price <service> <country>' },
  { command: 'status', description: 'Cek kode OTP: /status <id>' },
  { command: 'cancel', description: 'Batalkan aktivasi & refund: /cancel <id>' },
  { command: 'finish', description: 'Selesaikan aktivasi: /finish <id>' },
  { command: 'help', description: 'Panduan & daftar kode populer' },
];

function isAuthorized(userId) {
  const { allowedUserIds } = getEnvConfig();
  if (allowedUserIds.length === 0) return true;
  return allowedUserIds.includes(String(userId));
}

function chunk(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function mainMenuMarkup() {
  return {
    inline_keyboard: [
      [
        { text: '🛒 Order Nomor', callback_data: 'm:services' },
        { text: '💰 Cek Saldo', callback_data: 'a:balance' },
      ],
      [
        { text: '📋 Order Aktif', callback_data: 'a:active' },
        { text: '📖 Panduan & Kode', callback_data: 'm:help' },
      ],
    ],
  };
}

function mainMenuText(firstName) {
  const { autoCancelSeconds } = getEnvConfig();
  return (
    `🐻 <b>GrizzlySMS Bot</b>\n\n` +
    `Halo <b>${escapeHtml(firstName || 'User')}</b>! Pilih menu di bawah atau gunakan command langsung:\n` +
    `• <code>/order wa 6</code> — Order 1 nomor WhatsApp Indonesia\n` +
    `• <code>/order wa 6 3</code> — Order 3 nomor sekaligus\n` +
    `• <code>/order wa 6 telkomsel 5</code> — Order 5 nomor khusus Telkomsel\n` +
    `• <code>/active</code> — Cek order aktif\n` +
    `• <code>/balance</code> — Cek saldo akun\n\n` +
    `⏱️ <i>Auto-cancel aktif: nomor tanpa OTP selama ${autoCancelSeconds} detik akan dibatalkan otomatis.</i>`
  );
}

function helpText() {
  const { autoCancelSeconds, maxOrderQty } = getEnvConfig();
  const svcList = POPULAR_SERVICES.map((s) => `<code>${s.code}</code>=${s.name}`).join(', ');
  const countryList = POPULAR_COUNTRIES.map((c) => `<code>${c.id}</code>=${c.name}`).join(', ');

  return (
    `📖 <b>Panduan GrizzlySMS Bot</b>\n\n` +
    `<b>Perintah Utama:</b>\n` +
    `• <code>/start</code> — Menu interaktif (pilih layanan, negara, operator, & jumlah)\n` +
    `• <code>/balance</code> — Cek saldo GrizzlySMS\n` +
    `• <code>/order &lt;service&gt; &lt;country&gt; [operator] [jumlah] [maxPrice]</code>\n` +
    `  Contoh:\n` +
    `  - <code>/order wa 6</code> (1 nomor, operator acak)\n` +
    `  - <code>/order wa 6 3</code> (3 nomor sekaligus)\n` +
    `  - <code>/order wa 6 telkomsel 5</code> (5 nomor Telkomsel)\n` +
    `  - <code>/order wa 6 telkomsel 2 0.5</code> (2 nomor, maxPrice 0.5)\n` +
    `  <i>Maksimal ${maxOrderQty} nomor per order.</i>\n` +
    `• <code>/active</code> — Lihat semua order aktif & sisa waktu\n` +
    `• <code>/operators &lt;country&gt;</code> — Cek daftar operator negara\n` +
    `• <code>/price &lt;service&gt; &lt;country&gt;</code> — Cek harga & stok\n` +
    `• <code>/status &lt;id&gt;</code> — Cek OTP masuk\n` +
    `• <code>/retry &lt;id&gt;</code> — Minta SMS tambahan\n` +
    `• <code>/finish &lt;id&gt;</code> — Selesaikan order\n` +
    `• <code>/cancel &lt;id&gt;</code> — Batalkan & refund\n\n` +
    `<b>Auto-Cancel:</b>\n` +
    `Jika OTP belum masuk selama <b>${autoCancelSeconds} detik</b>, nomor akan otomatis di-cancel & refund.\n\n` +
    `<b>Kode Layanan Populer:</b>\n${svcList}\n\n` +
    `<b>ID Negara Populer:</b>\n${countryList}\n\n` +
    `💡 <i>Tip: Klik nomor telepon atau kode OTP untuk langsung menyalinnya.</i>`
  );
}

function buildOrderButtons(id, phone, createdSec = 0, finished = false) {
  if (finished) {
    return {
      inline_keyboard: [
        [
          { text: '🛒 Order Lagi', callback_data: 'm:services' },
          { text: '💰 Cek Saldo', callback_data: 'a:balance' },
        ],
      ],
    };
  }

  // Format callback_data <= 64 byte: <act>:<id>:<createdSec>:<phone>
  const ts = createdSec || Math.floor(Date.now() / 1000);
  const safePhone = String(phone || '').slice(0, 20);
  const suffix = safePhone ? `${id}:${ts}:${safePhone}` : `${id}:${ts}`;

  return {
    inline_keyboard: [
      [{ text: '🔄 Cek OTP', callback_data: `o:${suffix}` }],
      [
        { text: '📩 Minta SMS Lagi', callback_data: `r:${suffix}` },
        { text: '✅ Selesai', callback_data: `f:${suffix}` },
      ],
      [{ text: '❌ Cancel (Refund)', callback_data: `c:${suffix}` }],
    ],
  };
}

function formatOrderCard({
  id,
  phone,
  service,
  country,
  operator,
  statusText,
  otpCode,
  createdSec,
  finished = false,
}) {
  const { autoCancelSeconds } = getEnvConfig();
  const lines = [
    `📱 <b>Order Aktif GrizzlySMS</b>`,
    ``,
    `🆔 ID: <code>${escapeHtml(id)}</code>`,
  ];
  if (phone) {
    lines.push(`📞 Nomor: <code>${escapeHtml(phone)}</code>`);
  }
  if (service) {
    lines.push(`📦 Layanan: ${escapeHtml(getServiceLabel(service))}`);
  }
  if (country) {
    lines.push(`🌍 Negara: ${escapeHtml(getCountryLabel(country))}`);
  }
  if (operator) {
    lines.push(`📡 Operator: ${escapeHtml(getOperatorLabel(operator))}`);
  }
  if (otpCode) {
    lines.push(`🔐 Kode OTP: <code>${escapeHtml(otpCode)}</code>`);
  }
  lines.push(`📌 Status: ${escapeHtml(statusText)}`);

  if (!finished && !otpCode && createdSec) {
    const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - createdSec);
    const remaining = Math.max(0, autoCancelSeconds - elapsed);
    lines.push(`⏱️ Auto-cancel: ${remaining} detik tersisa (batas ${autoCancelSeconds} dtk)`);
  }

  lines.push(``);
  if (!finished) {
    lines.push(`<i>Klik "🔄 Cek OTP" kapan saja setelah SMS dikirim.</i>`);
  }
  return lines.join('\n');
}

function extractPriceInfo(priceData, service, country) {
  if (!priceData || typeof priceData !== 'object') return null;

  const byCountry = priceData[String(country)];
  if (byCountry && typeof byCountry === 'object') {
    const entry = byCountry[String(service).toLowerCase()];
    if (entry && typeof entry === 'object') {
      return {
        cost: entry.cost ?? entry.price ?? null,
        count: entry.count ?? entry.quantity ?? null,
      };
    }
  }
  return null;
}

async function getOperatorsForCountry(country) {
  const res = await grizzly.getOperators(country);
  if (res.ok && res.operators.length > 0) {
    return { operators: res.operators, fromApi: true };
  }
  return {
    operators: FALLBACK_OPERATORS_BY_COUNTRY[String(country)] || [],
    fromApi: false,
  };
}

export function parseOrderArgs(args, maxOrderQty = 10) {
  const [service, country, arg3, arg4, arg5] = args;
  if (!service || !country) return null;

  let operator = 'any';
  let qty = 1;
  let maxPrice;

  const isIntQty = (v) => /^\d+$/.test(v) && Number.parseInt(v, 10) >= 1 && Number.parseInt(v, 10) <= maxOrderQty;
  const isPrice = (v) => /^\d+(\.\d+)?$/.test(v);

  if (arg3 !== undefined) {
    if (isIntQty(arg3) && !arg3.includes('.')) {
      qty = Number.parseInt(arg3, 10);
      if (arg4 !== undefined && isPrice(arg4)) {
        maxPrice = arg4;
      }
    } else if (isPrice(arg3) && arg4 === undefined) {
      maxPrice = arg3;
    } else {
      operator = arg3;
      if (arg4 !== undefined) {
        if (isIntQty(arg4) && !arg4.includes('.')) {
          qty = Number.parseInt(arg4, 10);
          if (arg5 !== undefined && isPrice(arg5)) {
            maxPrice = arg5;
          }
        } else if (isPrice(arg4)) {
          maxPrice = arg4;
        }
      }
    }
  }

  return {
    service: service.toLowerCase(),
    country: String(country),
    operator,
    qty,
    maxPrice,
  };
}

async function handleBalance(chatId, messageId = null) {
  const res = await grizzly.getBalance();
  const text = res.ok
    ? `💰 <b>Saldo GrizzlySMS</b>\n\nSaldo saat ini: <b>${escapeHtml(res.balance)}</b>${res.currency ? ` ${escapeHtml(res.currency)}` : ''}`
    : `⚠️ <b>Gagal cek saldo</b>\n${escapeHtml(res.error)}`;

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: '🔄 Refresh Saldo', callback_data: 'a:balance' },
        { text: '🛒 Order Nomor', callback_data: 'm:services' },
      ],
      [{ text: '⬅️ Menu Utama', callback_data: 'm:home' }],
    ],
  };

  if (messageId) {
    await tg.editMessageText(chatId, messageId, text, { reply_markup: replyMarkup });
  } else {
    await tg.sendMessage(chatId, text, { reply_markup: replyMarkup });
  }
}

async function handlePriceCommand(chatId, args) {
  const [service, country] = args;
  if (!service || !country) {
    await tg.sendMessage(
      chatId,
      `Format: <code>/price &lt;service&gt; &lt;country&gt;</code>\nContoh: <code>/price wa 6</code>`
    );
    return;
  }

  const res = await grizzly.getPrices(service, country);
  if (!res.ok) {
    await tg.sendMessage(chatId, `⚠️ <b>Gagal cek harga</b>\n${escapeHtml(res.error)}`);
    return;
  }

  const info = extractPriceInfo(res.data, service, country);
  if (!info) {
    await tg.sendMessage(
      chatId,
      `ℹ️ Data harga tidak ditemukan untuk <b>${escapeHtml(getServiceLabel(service))}</b> di <b>${escapeHtml(getCountryLabel(country))}</b>.`
    );
    return;
  }

  const text =
    `🏷️ <b>Info Harga & Stok</b>\n\n` +
    `📦 Layanan: ${escapeHtml(getServiceLabel(service))}\n` +
    `🌍 Negara: ${escapeHtml(getCountryLabel(country))}\n` +
    `💵 Harga: <b>${escapeHtml(info.cost ?? '-')}</b>\n` +
    `📊 Stok: <b>${escapeHtml(info.count ?? '-')}</b>`;

  await tg.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '📡 Pilih Operator',
            callback_data: `cty:${service.toLowerCase()}:${country}`,
          },
          {
            text: '✅ Order 1 (Any)',
            callback_data: `buy:${service.toLowerCase()}:${country}:any:1`,
          },
        ],
      ],
    },
  });
}

async function handleOperatorsCommand(chatId, args) {
  const [country] = args;
  if (!country) {
    await tg.sendMessage(
      chatId,
      `Format: <code>/operators &lt;country_id&gt;</code>\nContoh: <code>/operators 6</code> (Indonesia)`
    );
    return;
  }

  const { operators, fromApi } = await getOperatorsForCountry(country);
  if (operators.length === 0) {
    await tg.sendMessage(
      chatId,
      `ℹ️ Daftar operator khusus untuk <b>${escapeHtml(getCountryLabel(country))}</b> tidak ditemukan. Kamu tetap bisa order dengan operator otomatis (<code>any</code>).`
    );
    return;
  }

  const listText = operators.map((op) => `<code>${escapeHtml(op)}</code>`).join(', ');
  const sourceNote = fromApi
    ? 'Data langsung dari API GrizzlySMS.'
    : 'Daftar operator umum (API tidak mengembalikan daftar khusus).';

  await tg.sendMessage(
    chatId,
    `📡 <b>Daftar Operator — ${escapeHtml(getCountryLabel(country))}</b>\n\n` +
      `${listText}\n\n` +
      `Contoh order 3 nomor:\n<code>/order wa ${escapeHtml(country)} ${escapeHtml(operators[0])} 3</code>\n` +
      `<i>${sourceNote}</i>`
  );
}

async function handleActiveOrders(chatId, messageId = null) {
  const { autoCancelSeconds } = getEnvConfig();
  const res = await grizzly.getActiveActivations();

  if (!res.ok) {
    const text = `⚠️ <b>Gagal mengambil daftar order aktif</b>\n${escapeHtml(res.error)}`;
    const markup = {
      inline_keyboard: [[{ text: '⬅️ Menu Utama', callback_data: 'm:home' }]],
    };
    if (messageId) {
      await tg.editMessageText(chatId, messageId, text, { reply_markup: markup });
    } else {
      await tg.sendMessage(chatId, text, { reply_markup: markup });
    }
    return;
  }

  const orders = res.activations;
  if (orders.length === 0) {
    const text = `📋 <b>Order Aktif</b>\n\nTidak ada order yang sedang aktif di GrizzlySMS.`;
    const markup = {
      inline_keyboard: [
        [
          { text: '🛒 Order Nomor', callback_data: 'm:services' },
          { text: '⬅️ Menu Utama', callback_data: 'm:home' },
        ],
      ],
    };
    if (messageId) {
      await tg.editMessageText(chatId, messageId, text, { reply_markup: markup });
    } else {
      await tg.sendMessage(chatId, text, { reply_markup: markup });
    }
    return;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const lines = [`📋 <b>Order Aktif di GrizzlySMS (${orders.length})</b>`, ``];
  for (const o of orders) {
    let timeInfo = '';
    if (o.createdAt) {
      const elapsed = Math.max(0, nowSec - Math.floor(o.createdAt / 1000));
      const remaining = Math.max(0, autoCancelSeconds - elapsed);
      timeInfo = ` — sisa <b>${remaining} dtk</b>`;
    }
    const otpInfo = o.smsCode ? ` | OTP: <code>${escapeHtml(o.smsCode)}</code>` : '';
    lines.push(
      `• <code>${escapeHtml(o.phone || o.id)}</code> (ID: <code>${escapeHtml(o.id)}</code>)${otpInfo}${timeInfo}`
    );
  }

  const markup = {
    inline_keyboard: [
      [{ text: '🔄 Cek & Proses Auto-Cancel', callback_data: 'a:checkall' }],
      [
        { text: '🛒 Order Lagi', callback_data: 'm:services' },
        { text: '⬅️ Menu Utama', callback_data: 'm:home' },
      ],
    ],
  };

  if (messageId) {
    await tg.editMessageText(chatId, messageId, lines.join('\n'), { reply_markup: markup });
  } else {
    await tg.sendMessage(chatId, lines.join('\n'), { reply_markup: markup });
  }
}

async function executeOrder(
  chatId,
  { service, country, operator = 'any', qty = 1, maxPrice },
  editMessageId = null
) {
  const { maxOrderQty, autoCancelSeconds } = getEnvConfig();
  const safeOp = String(operator || 'any').trim() || 'any';
  const count = Math.min(maxOrderQty, Math.max(1, Number.parseInt(qty, 10) || 1));

  if (editMessageId && count > 1) {
    await tg.editMessageText(
      chatId,
      editMessageId,
      `⏳ Memproses order <b>${count} nomor</b> (${escapeHtml(getServiceLabel(service))} — ${escapeHtml(getCountryLabel(country))} — ${escapeHtml(getOperatorLabel(safeOp))})...`
    );
  }

  // Order dalam batch paralel (maks 5 sekaligus) agar cepat & aman untuk timeout Vercel
  const results = [];
  const batchSize = 5;
  for (let i = 0; i < count; i += batchSize) {
    const currentBatch = Math.min(batchSize, count - i);
    const batchPromises = Array.from({ length: currentBatch }, () =>
      grizzly.getNumber({ service, country, operator: safeOp, maxPrice })
    );
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Jika ada NO_BALANCE atau NO_NUMBERS, hentikan batch berikutnya agar tidak spam API
    const stopEarly = batchResults.some(
      (r) => !r.ok && (r.raw === 'NO_BALANCE' || r.raw === 'NO_NUMBERS')
    );
    if (stopEarly) break;
  }

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  if (succeeded.length === 0) {
    const firstError = failed[0]?.error || 'Gagal mendapatkan nomor.';
    const errText =
      `⚠️ <b>Gagal Order Nomor</b>\n\n` +
      `📦 Layanan: ${escapeHtml(getServiceLabel(service))}\n` +
      `🌍 Negara: ${escapeHtml(getCountryLabel(country))}\n` +
      `📡 Operator: ${escapeHtml(getOperatorLabel(safeOp))}\n` +
      `❌ Alasan: ${escapeHtml(firstError)}`;

    const markup = {
      inline_keyboard: [
        [
          {
            text: '🔄 Coba Lagi',
            callback_data: `buy:${service}:${country}:${safeOp.slice(0, 20)}:${count}`,
          },
          { text: '📡 Ganti Operator', callback_data: `cty:${service}:${country}` },
        ],
        [{ text: '⬅️ Pilih Negara', callback_data: `svc:${service}` }],
      ],
    };

    if (editMessageId) {
      await tg.editMessageText(chatId, editMessageId, errText, { reply_markup: markup });
    } else {
      await tg.sendMessage(chatId, errText, { reply_markup: markup });
    }
    return;
  }

  // Jika order > 1, tampilkan ringkasan dulu lalu kirim kartu untuk tiap nomor
  if (count > 1) {
    const summaryText =
      `📦 <b>Order Massal Selesai</b>\n\n` +
      `✅ Berhasil: <b>${succeeded.length}/${count}</b> nomor` +
      (failed.length > 0
        ? `\n⚠️ Gagal: <b>${failed.length}</b> (${escapeHtml(failed[0]?.error || 'Error')})`
        : '') +
      `\n⏱️ Nomor tanpa OTP dalam <b>${autoCancelSeconds} detik</b> akan otomatis di-cancel.`;

    if (editMessageId) {
      await tg.editMessageText(chatId, editMessageId, summaryText);
    } else {
      await tg.sendMessage(chatId, summaryText);
    }
  }

  for (let idx = 0; idx < succeeded.length; idx++) {
    const item = succeeded[idx];
    const nowMs = Date.now();
    const createdSec = Math.floor(nowMs / 1000);

    const cardText = formatOrderCard({
      id: item.id,
      phone: item.phone,
      service,
      country,
      operator: safeOp,
      statusText: '⏳ Menunggu SMS masuk...',
      createdSec,
    });
    const markup = buildOrderButtons(item.id, item.phone, createdSec, false);

    if (count === 1 && editMessageId) {
      await tg.editMessageText(chatId, editMessageId, cardText, {
        reply_markup: markup,
      });
    } else {
      await tg.sendMessage(chatId, cardText, { reply_markup: markup });
    }
  }
}

async function handleStatusCheck(
  chatId,
  id,
  { phone = '', createdSec = 0 } = {},
  editMessageId = null
) {
  const { autoCancelSeconds } = getEnvConfig();
  const res = await grizzly.getStatus(id);

  if (!res.ok) {
    const text = `⚠️ <b>Gagal cek status #${escapeHtml(id)}</b>\n${escapeHtml(res.error)}`;
    if (editMessageId) {
      await tg.editMessageText(chatId, editMessageId, text, {
        reply_markup: buildOrderButtons(id, phone, createdSec, false),
      });
    } else {
      await tg.sendMessage(chatId, text);
    }
    return;
  }

  // Lazy auto-cancel fallback jika sudah >= 310 detik dan masih menunggu OTP
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    res.state === 'WAIT_CODE' &&
    createdSec > 0 &&
    nowSec - createdSec >= autoCancelSeconds
  ) {
    const cancelRes = await grizzly.setStatus(id, 8);

    const statusMsg = cancelRes.ok
      ? `⏱️ Timeout ${autoCancelSeconds} detik — otomatis dibatalkan & refund.`
      : `⏱️ Timeout ${autoCancelSeconds} detik — gagal auto-cancel (${cancelRes.error}).`;

    const cardText = formatOrderCard({
      id,
      phone,
      statusText: statusMsg,
      createdSec,
      finished: cancelRes.ok,
    });
    const markup = buildOrderButtons(id, phone, createdSec, cancelRes.ok);

    if (editMessageId) {
      await tg.editMessageText(chatId, editMessageId, cardText, { reply_markup: markup });
    } else {
      await tg.sendMessage(chatId, cardText, { reply_markup: markup });
    }
    return;
  }

  const isDone = res.state === 'CANCEL';
  const statusIcon = res.state === 'OK' ? '✅' : res.state === 'CANCEL' ? '❌' : '⏳';

  const cardText = formatOrderCard({
    id,
    phone,
    otpCode: res.code,
    statusText: `${statusIcon} ${res.message}`,
    createdSec,
    finished: isDone,
  });
  const markup = buildOrderButtons(id, phone, createdSec, isDone);

  if (editMessageId) {
    await tg.editMessageText(chatId, editMessageId, cardText, { reply_markup: markup });
  } else {
    await tg.sendMessage(chatId, cardText, { reply_markup: markup });
  }
}

async function handleSetStatus(
  chatId,
  id,
  status,
  { phone = '', createdSec = 0 } = {},
  editMessageId = null
) {
  const res = await grizzly.setStatus(id, status);
  if (!res.ok) {
    const text = `⚠️ <b>Gagal ubah status #${escapeHtml(id)}</b>\n${escapeHtml(res.error)}`;
    if (editMessageId) {
      await tg.editMessageText(chatId, editMessageId, text, {
        reply_markup: buildOrderButtons(id, phone, createdSec, false),
      });
    } else {
      await tg.sendMessage(chatId, text);
    }
    return;
  }

  const finished = status === 6 || status === 8;

  const icon = status === 6 ? '✅' : status === 8 ? '❌' : '📩';
  const cardText = formatOrderCard({
    id,
    phone,
    statusText: `${icon} ${res.message}`,
    createdSec,
    finished,
  });
  const markup = buildOrderButtons(id, phone, createdSec, finished);

  if (editMessageId) {
    await tg.editMessageText(chatId, editMessageId, cardText, { reply_markup: markup });
  } else {
    await tg.sendMessage(chatId, cardText, { reply_markup: markup });
  }
}

/**
 * Dipanggil oleh /api/cron-autocancel (setiap 1 menit via cron-job.org gratis) atau tombol "Cek & Proses Auto-Cancel".
 * Mengambil order aktif langsung dari API GrizzlySMS (getActiveActivations) — TANPA database!
 * Jika OTP belum masuk & umur order >= autoCancelSeconds (310 detik) -> auto-cancel & refund + kirim notif Telegram.
 */
export async function processActiveOrders(targetChatId = null) {
  const { autoCancelSeconds, notifyChatId } = getEnvConfig();
  const chatId = targetChatId || notifyChatId;

  const activeRes = await grizzly.getActiveActivations();
  if (!activeRes.ok) {
    return {
      ok: false,
      error: activeRes.error,
      checked: 0,
      otpFound: 0,
      autoCancelled: 0,
    };
  }

  const orders = activeRes.activations;
  const nowMs = Date.now();

  let otpFound = 0;
  let autoCancelled = 0;
  let errors = 0;

  for (const order of orders) {
    try {
      const statusRes = await grizzly.getStatus(order.id);
      if (!statusRes.ok) continue;

      if (statusRes.state === 'OK') {
        otpFound++;
        continue;
      }

      if (statusRes.state === 'WAIT_CODE' && order.createdAt) {
        const elapsedSec = Math.floor((nowMs - order.createdAt) / 1000);
        if (elapsedSec >= autoCancelSeconds) {
          const cancelRes = await grizzly.setStatus(order.id, 8);
          if (cancelRes.ok) {
            autoCancelled++;
            if (chatId) {
              await tg
                .sendMessage(
                  chatId,
                  `⏱️ <b>Auto-Cancel (${autoCancelSeconds} detik)</b>\n` +
                    `📞 Nomor: <code>${escapeHtml(order.phone || '-')}</code>\n` +
                    `🆔 ID: <code>${escapeHtml(order.id)}</code>\n` +
                    `❌ Tidak ada OTP masuk selama ${autoCancelSeconds} detik, nomor otomatis dibatalkan & saldo dikembalikan.`
                )
                .catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      errors++;
      console.error(`[AutoCancel Error #${order.id}]`, err);
    }
  }

  return {
    ok: true,
    checked: orders.length,
    otpFound,
    autoCancelled,
    errors,
  };
}

async function handleMessage(message) {
  const chatId = message.chat?.id;
  const userId = message.from?.id;
  const text = (message.text || '').trim();
  if (!chatId || !text) return;

  if (!isAuthorized(userId)) {
    await tg.sendMessage(
      chatId,
      `⛔ <b>Akses ditolak.</b>\nTelegram User ID kamu: <code>${escapeHtml(userId)}</code>\nTambahkan ID ini ke <code>ALLOWED_USER_IDS</code> di Vercel jika kamu pemilik bot.`
    );
    return;
  }

  const parts = text.split(/\s+/);
  const rawCommand = parts[0].toLowerCase().split('@')[0];
  const args = parts.slice(1);

  switch (rawCommand) {
    case '/start':
    case '/menu':
      await tg.sendMessage(chatId, mainMenuText(message.from?.first_name), {
        reply_markup: mainMenuMarkup(),
      });
      break;

    case '/help':
      await tg.sendMessage(chatId, helpText(), {
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Menu Utama', callback_data: 'm:home' }]],
        },
      });
      break;

    case '/balance':
    case '/saldo':
      await handleBalance(chatId);
      break;

    case '/active':
    case '/aktif':
      await handleActiveOrders(chatId);
      break;

    case '/price':
    case '/harga':
      await handlePriceCommand(chatId, args);
      break;

    case '/operators':
    case '/operator':
      await handleOperatorsCommand(chatId, args);
      break;

    case '/order': {
      const { maxOrderQty } = getEnvConfig();
      const parsed = parseOrderArgs(args, maxOrderQty);
      if (!parsed) {
        await tg.sendMessage(
          chatId,
          `Format: <code>/order &lt;service&gt; &lt;country&gt; [operator] [jumlah] [maxPrice]</code>\n` +
            `Contoh:\n` +
            `• <code>/order wa 6</code> (1 nomor)\n` +
            `• <code>/order wa 6 3</code> (3 nomor sekaligus)\n` +
            `• <code>/order wa 6 telkomsel 5</code> (5 nomor Telkomsel)\n` +
            `• <code>/order wa 6 telkomsel 2 0.5</code> (2 nomor, maxPrice 0.5)`
        );
        return;
      }
      await executeOrder(chatId, parsed);
      break;
    }

    case '/status':
    case '/otp': {
      const [id] = args;
      if (!id) {
        await tg.sendMessage(chatId, `Format: <code>/status &lt;activation_id&gt;</code>`);
        return;
      }
      await handleStatusCheck(chatId, id);
      break;
    }

    case '/retry': {
      const [id] = args;
      if (!id) {
        await tg.sendMessage(chatId, `Format: <code>/retry &lt;activation_id&gt;</code>`);
        return;
      }
      await handleSetStatus(chatId, id, 3);
      break;
    }

    case '/finish': {
      const [id] = args;
      if (!id) {
        await tg.sendMessage(chatId, `Format: <code>/finish &lt;activation_id&gt;</code>`);
        return;
      }
      await handleSetStatus(chatId, id, 6);
      break;
    }

    case '/cancel': {
      const [id] = args;
      if (!id) {
        await tg.sendMessage(chatId, `Format: <code>/cancel &lt;activation_id&gt;</code>`);
        return;
      }
      await handleSetStatus(chatId, id, 8);
      break;
    }

    default:
      await tg.sendMessage(
        chatId,
        `Perintah tidak dikenali. Ketik /start untuk membuka menu atau /help untuk bantuan.`
      );
      break;
  }
}

function parseOrderActionCallback(data) {
  // Format baru: <act>:<id>:<createdSec>:<phone>
  // Format lama (kompatibilitas mundur): <act>:<id>:<phone>
  const parts = data.split(':');
  const action = parts[0];
  const id = parts[1];
  if (!id) return null;

  const third = parts[2] || '';
  if (/^\d{9,11}$/.test(third)) {
    return {
      action,
      id,
      createdSec: Number.parseInt(third, 10),
      phone: parts.slice(3).join(':'),
    };
  }
  return {
    action,
    id,
    createdSec: 0,
    phone: parts.slice(2).join(':'),
  };
}

async function handleCallbackQuery(query) {
  const userId = query.from?.id;
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const data = query.data || '';

  if (!isAuthorized(userId)) {
    await tg.answerCallbackQuery(query.id, '⛔ Akses ditolak.', true);
    return;
  }

  await tg.answerCallbackQuery(query.id);
  if (!chatId || !messageId) return;

  if (data === 'm:home') {
    await tg.editMessageText(chatId, messageId, mainMenuText(query.from?.first_name), {
      reply_markup: mainMenuMarkup(),
    });
    return;
  }

  if (data === 'm:help') {
    await tg.editMessageText(chatId, messageId, helpText(), {
      reply_markup: {
        inline_keyboard: [[{ text: '⬅️ Menu Utama', callback_data: 'm:home' }]],
      },
    });
    return;
  }

  if (data === 'a:balance') {
    await handleBalance(chatId, messageId);
    return;
  }

  if (data === 'a:active') {
    await handleActiveOrders(chatId, messageId);
    return;
  }

  if (data === 'a:checkall') {
    const summary = await processActiveOrders(chatId);
    await tg.sendMessage(
      chatId,
      `🔄 <b>Cek & Auto-Cancel Selesai</b>\nDiperiksa: ${summary.checked} | Ada OTP: ${summary.otpFound} | Auto-Cancel: ${summary.autoCancelled}`
    );
    await handleActiveOrders(chatId, messageId);
    return;
  }

  if (data === 'm:services') {
    const buttons = chunk(
      POPULAR_SERVICES.map((s) => ({
        text: `${s.emoji} ${s.name}`,
        callback_data: `svc:${s.code}`,
      })),
      2
    );
    buttons.push([{ text: '⬅️ Menu Utama', callback_data: 'm:home' }]);

    await tg.editMessageText(
      chatId,
      messageId,
      `🛒 <b>Pilih Layanan</b>\n\nPilih aplikasi/layanan yang ingin diorder.\n<i>Layanan lain? Gunakan <code>/order &lt;kode&gt; &lt;negara&gt; [operator] [jumlah]</code></i>`,
      { reply_markup: { inline_keyboard: buttons } }
    );
    return;
  }

  if (data.startsWith('svc:')) {
    const service = data.slice(4);
    const priceRes = await grizzly.getPrices(service);
    const priceData = priceRes.ok ? priceRes.data : null;

    const buttons = chunk(
      POPULAR_COUNTRIES.map((c) => {
        const info = extractPriceInfo(priceData, service, c.id);
        const label =
          info && info.cost !== null
            ? `${c.flag} ${c.name} (${info.cost})`
            : `${c.flag} ${c.name}`;
        return {
          text: label,
          callback_data: `cty:${service}:${c.id}`,
        };
      }),
      2
    );
    buttons.push([
      { text: '⬅️ Pilih Layanan', callback_data: 'm:services' },
      { text: '🏠 Menu Utama', callback_data: 'm:home' },
    ]);

    await tg.editMessageText(
      chatId,
      messageId,
      `🌍 <b>Pilih Negara</b>\n\n📦 Layanan: <b>${escapeHtml(getServiceLabel(service))}</b>\nPilih negara di bawah ini (angka dalam kurung adalah harga saat ini):`,
      { reply_markup: { inline_keyboard: buttons } }
    );
    return;
  }

  if (data.startsWith('cty:')) {
    const [, service, country] = data.split(':');
    const { operators } = await getOperatorsForCountry(country);

    const opButtons = chunk(
      operators.slice(0, 20).map((op) => ({
        text: `📡 ${op}`,
        callback_data: `cf:${service}:${country}:${op.slice(0, 20)}`,
      })),
      2
    );

    const keyboard = [
      [{ text: '🎲 Any Operator (Otomatis)', callback_data: `cf:${service}:${country}:any` }],
      ...opButtons,
      [
        { text: '⬅️ Ganti Negara', callback_data: `svc:${service}` },
        { text: '🏠 Menu Utama', callback_data: 'm:home' },
      ],
    ];

    await tg.editMessageText(
      chatId,
      messageId,
      `📡 <b>Pilih Operator</b>\n\n` +
        `📦 Layanan: <b>${escapeHtml(getServiceLabel(service))}</b>\n` +
        `🌍 Negara: <b>${escapeHtml(getCountryLabel(country))}</b>\n\n` +
        `Pilih operator yang diinginkan atau pilih <b>Any Operator</b> untuk otomatis:`,
      { reply_markup: { inline_keyboard: keyboard } }
    );
    return;
  }

  if (data.startsWith('cf:')) {
    const [, service, country, rawOperator] = data.split(':');
    const operator = rawOperator || 'any';
    const { autoCancelSeconds, maxOrderQty } = getEnvConfig();
    const priceRes = await grizzly.getPrices(service, country);
    const info = priceRes.ok ? extractPriceInfo(priceRes.data, service, country) : null;

    const text =
      `🧾 <b>Konfirmasi & Pilih Jumlah Order</b>\n\n` +
      `📦 Layanan: <b>${escapeHtml(getServiceLabel(service))}</b>\n` +
      `🌍 Negara: <b>${escapeHtml(getCountryLabel(country))}</b>\n` +
      `📡 Operator: <b>${escapeHtml(getOperatorLabel(operator))}</b>\n` +
      `💵 Harga/nomor: <b>${escapeHtml(info?.cost ?? 'Cek saat order')}</b>\n` +
      `📊 Stok: <b>${escapeHtml(info?.count ?? '-')}</b>\n` +
      `⏱️ Auto-cancel: <b>${autoCancelSeconds} detik</b> jika OTP tidak masuk\n\n` +
      `Pilih jumlah nomor yang ingin diorder:`;

    const qtyOptions = [1, 2, 3, 5, 10].filter((n) => n <= maxOrderQty);
    const opSafe = operator.slice(0, 20);
    const qtyRows = chunk(
      qtyOptions.map((n) => ({
        text: `✅ Beli ${n}`,
        callback_data: `buy:${service}:${country}:${opSafe}:${n}`,
      })),
      3
    );

    await tg.editMessageText(chatId, messageId, text, {
      reply_markup: {
        inline_keyboard: [
          ...qtyRows,
          [
            { text: '⬅️ Ganti Operator', callback_data: `cty:${service}:${country}` },
            { text: '🏠 Menu Utama', callback_data: 'm:home' },
          ],
        ],
      },
    });
    return;
  }

  if (data.startsWith('buy:')) {
    const [, service, country, rawOperator, rawQty] = data.split(':');
    const operator = rawOperator || 'any';
    const qty = Number.parseInt(rawQty || '1', 10) || 1;
    await executeOrder(chatId, { service, country, operator, qty }, messageId);
    return;
  }

  const parsed = parseOrderActionCallback(data);
  if (!parsed) return;

  const { action, id, createdSec, phone } = parsed;
  if (action === 'o') {
    await handleStatusCheck(chatId, id, { phone, createdSec }, messageId);
  } else if (action === 'r') {
    await handleSetStatus(chatId, id, 3, { phone, createdSec }, messageId);
  } else if (action === 'f') {
    await handleSetStatus(chatId, id, 6, { phone, createdSec }, messageId);
  } else if (action === 'c') {
    await handleSetStatus(chatId, id, 8, { phone, createdSec }, messageId);
  }
}

export async function handleUpdate(update) {
  if (!update || typeof update !== 'object') return;

  if (update.message) {
    await handleMessage(update.message);
  } else if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  }
}
