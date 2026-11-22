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
  { command: 'order', description: 'Order cepat: /order <service> <country> [operator] [maxPrice]' },
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
      [{ text: '📋 Panduan & Kode', callback_data: 'm:help' }],
    ],
  };
}

function mainMenuText(firstName) {
  return (
    `🐻 <b>GrizzlySMS Bot</b>\n\n` +
    `Halo <b>${escapeHtml(firstName || 'User')}</b>! Pilih menu di bawah atau gunakan command langsung:\n` +
    `• <code>/order wa 6</code> — Order cepat WhatsApp Indonesia (operator acak)\n` +
    `• <code>/order wa 6 telkomsel</code> — Order WhatsApp Indonesia khusus Telkomsel\n` +
    `• <code>/operators 6</code> — Lihat operator tersedia untuk Indonesia\n` +
    `• <code>/balance</code> — Cek saldo akun`
  );
}

function helpText() {
  const svcList = POPULAR_SERVICES.map((s) => `<code>${s.code}</code>=${s.name}`).join(', ');
  const countryList = POPULAR_COUNTRIES.map((c) => `<code>${c.id}</code>=${c.name}`).join(', ');

  return (
    `📖 <b>Panduan GrizzlySMS Bot</b>\n\n` +
    `<b>Perintah Utama:</b>\n` +
    `• <code>/start</code> — Menu interaktif (pilih layanan, negara, & operator)\n` +
    `• <code>/balance</code> — Cek saldo GrizzlySMS\n` +
    `• <code>/order &lt;service&gt; &lt;country&gt; [operator] [maxPrice]</code>\n` +
    `  Contoh: <code>/order wa 6</code>, <code>/order wa 6 telkomsel</code>, atau <code>/order tg 187 any 0.5</code>\n` +
    `• <code>/operators &lt;country&gt;</code> — Cek daftar operator negara\n` +
    `  Contoh: <code>/operators 6</code>\n` +
    `• <code>/price &lt;service&gt; &lt;country&gt;</code> — Cek harga & stok\n` +
    `• <code>/status &lt;id&gt;</code> — Cek OTP masuk\n` +
    `• <code>/retry &lt;id&gt;</code> — Minta SMS tambahan\n` +
    `• <code>/finish &lt;id&gt;</code> — Selesaikan order\n` +
    `• <code>/cancel &lt;id&gt;</code> — Batalkan & refund\n\n` +
    `<b>Kode Layanan Populer:</b>\n${svcList}\n\n` +
    `<b>ID Negara Populer:</b>\n${countryList}\n\n` +
    `💡 <i>Tip: Klik nomor telepon atau kode OTP untuk langsung menyalinnya.</i>`
  );
}

function buildOrderButtons(id, phone, finished = false) {
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

  // Jaga agar callback_data selalu <= 64 byte
  const safePhone = String(phone || '').slice(0, 24);
  const suffix = safePhone ? `${id}:${safePhone}` : `${id}`;

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

function formatOrderCard({ id, phone, service, country, operator, statusText, otpCode }) {
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
  lines.push(``);
  lines.push(`<i>Klik tombol "🔄 Cek OTP" secara berkala setelah SMS dikirim.</i>`);
  return lines.join('\n');
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

function extractPriceInfo(priceData, service, country) {
  if (!priceData || typeof priceData !== 'object') return null;

  // Format umum SMS-Activate / GrizzlySMS: { "<country>": { "<service>": { cost, count } } }
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
            text: '✅ Order (Any)',
            callback_data: `buy:${service.toLowerCase()}:${country}:any`,
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
      `Contoh order:\n<code>/order wa ${escapeHtml(country)} ${escapeHtml(operators[0])}</code>\n` +
      `<i>${sourceNote}</i>`
  );
}

async function executeOrder(chatId, { service, country, operator = 'any', maxPrice }, editMessageId = null) {
  const safeOp = String(operator || 'any').trim() || 'any';
  const res = await grizzly.getNumber({ service, country, operator: safeOp, maxPrice });
  if (!res.ok) {
    const errText =
      `⚠️ <b>Gagal Order Nomor</b>\n\n` +
      `📦 Layanan: ${escapeHtml(getServiceLabel(service))}\n` +
      `🌍 Negara: ${escapeHtml(getCountryLabel(country))}\n` +
      `📡 Operator: ${escapeHtml(getOperatorLabel(safeOp))}\n` +
      `❌ Alasan: ${escapeHtml(res.error)}`;

    const markup = {
      inline_keyboard: [
        [
          { text: '🔄 Coba Lagi', callback_data: `buy:${service}:${country}:${safeOp.slice(0, 24)}` },
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

  const cardText = formatOrderCard({
    id: res.id,
    phone: res.phone,
    service,
    country,
    operator: safeOp,
    statusText: '⏳ Menunggu SMS masuk...',
  });
  const markup = buildOrderButtons(res.id, res.phone, false);

  if (editMessageId) {
    await tg.editMessageText(chatId, editMessageId, cardText, { reply_markup: markup });
  } else {
    await tg.sendMessage(chatId, cardText, { reply_markup: markup });
  }
}

async function handleStatusCheck(chatId, id, phone = '', editMessageId = null) {
  const res = await grizzly.getStatus(id);
  if (!res.ok) {
    const text = `⚠️ <b>Gagal cek status #${escapeHtml(id)}</b>\n${escapeHtml(res.error)}`;
    if (editMessageId) {
      await tg.editMessageText(chatId, editMessageId, text, {
        reply_markup: buildOrderButtons(id, phone, false),
      });
    } else {
      await tg.sendMessage(chatId, text);
    }
    return;
  }

  const isDone = res.state === 'CANCEL';
  const statusIcon =
    res.state === 'OK'
      ? '✅'
      : res.state === 'CANCEL'
        ? '❌'
        : '⏳';

  const cardText = formatOrderCard({
    id,
    phone,
    otpCode: res.code,
    statusText: `${statusIcon} ${res.message}`,
  });
  const markup = buildOrderButtons(id, phone, isDone);

  if (editMessageId) {
    await tg.editMessageText(chatId, editMessageId, cardText, { reply_markup: markup });
  } else {
    await tg.sendMessage(chatId, cardText, { reply_markup: markup });
  }
}

async function handleSetStatus(chatId, id, status, phone = '', editMessageId = null) {
  const res = await grizzly.setStatus(id, status);
  if (!res.ok) {
    const text = `⚠️ <b>Gagal ubah status #${escapeHtml(id)}</b>\n${escapeHtml(res.error)}`;
    if (editMessageId) {
      await tg.editMessageText(chatId, editMessageId, text, {
        reply_markup: buildOrderButtons(id, phone, false),
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
  });
  const markup = buildOrderButtons(id, phone, finished);

  if (editMessageId) {
    await tg.editMessageText(chatId, editMessageId, cardText, { reply_markup: markup });
  } else {
    await tg.sendMessage(chatId, cardText, { reply_markup: markup });
  }
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

    case '/price':
    case '/harga':
      await handlePriceCommand(chatId, args);
      break;

    case '/operators':
    case '/operator':
      await handleOperatorsCommand(chatId, args);
      break;

    case '/order': {
      const [service, country, arg3, arg4] = args;
      if (!service || !country) {
        await tg.sendMessage(
          chatId,
          `Format: <code>/order &lt;service&gt; &lt;country&gt; [operator] [maxPrice]</code>\n` +
            `Contoh:\n` +
            `• <code>/order wa 6</code>\n` +
            `• <code>/order wa 6 telkomsel</code>\n` +
            `• <code>/order wa 6 telkomsel 0.5</code>`
        );
        return;
      }

      // Jika arg3 berupa angka murni (misal 0.5), anggap sebagai maxPrice tanpa operator khusus
      let operator = 'any';
      let maxPrice;
      if (arg3 !== undefined) {
        if (/^\d+(\.\d+)?$/.test(arg3) && arg4 === undefined) {
          maxPrice = arg3;
        } else {
          operator = arg3;
          maxPrice = arg4;
        }
      }

      await executeOrder(chatId, {
        service: service.toLowerCase(),
        country,
        operator,
        maxPrice,
      });
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
      `🛒 <b>Pilih Layanan</b>\n\nPilih aplikasi/layanan yang ingin diorder.\n<i>Layanan lain? Gunakan <code>/order &lt;kode&gt; &lt;negara&gt;</code></i>`,
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

    // Batasi maksimal 20 tombol operator agar rapi & tidak melebihi batas Telegram
    const opButtons = chunk(
      operators.slice(0, 20).map((op) => ({
        text: `📡 ${op}`,
        callback_data: `cf:${service}:${country}:${op.slice(0, 24)}`,
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
    const priceRes = await grizzly.getPrices(service, country);
    const info = priceRes.ok ? extractPriceInfo(priceRes.data, service, country) : null;

    const text =
      `🧾 <b>Konfirmasi Order</b>\n\n` +
      `📦 Layanan: <b>${escapeHtml(getServiceLabel(service))}</b>\n` +
      `🌍 Negara: <b>${escapeHtml(getCountryLabel(country))}</b>\n` +
      `📡 Operator: <b>${escapeHtml(getOperatorLabel(operator))}</b>\n` +
      `💵 Harga: <b>${escapeHtml(info?.cost ?? 'Cek saat order')}</b>\n` +
      `📊 Stok: <b>${escapeHtml(info?.count ?? '-')}</b>\n\n` +
      `Klik <b>Beli Sekarang</b> untuk mendapatkan nomor.`;

    await tg.editMessageText(chatId, messageId, text, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '✅ Beli Sekarang',
              callback_data: `buy:${service}:${country}:${operator.slice(0, 24)}`,
            },
          ],
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
    const [, service, country, rawOperator] = data.split(':');
    const operator = rawOperator || 'any';
    await executeOrder(chatId, { service, country, operator }, messageId);
    return;
  }

  // Order actions: o=cek OTP, r=retry(3), f=finish(6), c=cancel(8)
  const [action, id, ...phoneParts] = data.split(':');
  const phone = phoneParts.join(':');

  if (action === 'o' && id) {
    await handleStatusCheck(chatId, id, phone, messageId);
  } else if (action === 'r' && id) {
    await handleSetStatus(chatId, id, 3, phone, messageId);
  } else if (action === 'f' && id) {
    await handleSetStatus(chatId, id, 6, phone, messageId);
  } else if (action === 'c' && id) {
    await handleSetStatus(chatId, id, 8, phone, messageId);
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
