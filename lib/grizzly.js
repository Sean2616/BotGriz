import {
  getEnvConfig,
  getIndonesiaPhoneException,
  normalizeOperatorCode,
} from './config.js';

const ERROR_MESSAGES = {
  BAD_KEY: 'API Key GrizzlySMS tidak valid. Periksa GRIZZLY_API_KEY di Vercel.',
  BAD_ACTION: 'Action API tidak valid.',
  BAD_SERVICE: 'Kode layanan tidak valid.',
  BAD_STATUS: 'Status aktivasi tidak valid atau sudah tidak bisa diubah.',
  NO_BALANCE: 'Saldo GrizzlySMS tidak mencukupi. Silakan top up terlebih dahulu.',
  NO_NUMBERS: 'Stok nomor sedang habis untuk layanan & negara ini.',
  NO_ACTIVATION: 'ID aktivasi tidak ditemukan.',
  WRONG_MAX_PRICE: 'Parameter maxPrice tidak valid.',
  WRONG_ACTIVATION_ID: 'ID aktivasi tidak valid.',
  EARLY_CANCEL_DENIED:
    'Belum bisa dibatalkan (biasanya harus tunggu ±2 menit setelah order sebelum cancel).',
  ERROR_SQL: 'Server GrizzlySMS sedang mengalami gangguan sementara. Coba lagi nanti.',
};

export function translateGrizzlyError(raw) {
  const key = String(raw || '').trim();
  if (ERROR_MESSAGES[key]) {
    return ERROR_MESSAGES[key];
  }
  if (key.startsWith('WRONG_MAX_PRICE:')) {
    const minPrice = key.split(':')[1];
    return `Harga minimal saat ini adalah ${minPrice}. Naikkan maxPrice atau order tanpa batas harga.`;
  }
  if (key.startsWith('BANNED:')) {
    return `Akun dibatasi sementara hingga: ${key.slice('BANNED:'.length)}`;
  }
  return `Respons GrizzlySMS: ${key || 'Kosong'}`;
}

async function callGrizzly(params) {
  const { grizzlyApiKey, grizzlyBaseUrl } = getEnvConfig();
  if (!grizzlyApiKey) {
    throw new Error('GRIZZLY_API_KEY belum diatur di Environment Variables.');
  }

  const url = new URL(grizzlyBaseUrl);
  url.searchParams.set('api_key', grizzlyApiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json, text/plain, */*' },
  });

  const text = (await res.text()).trim();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} dari GrizzlySMS: ${text.slice(0, 200)}`);
  }
  return text;
}

export async function getBalance() {
  const raw = await callGrizzly({ action: 'getBalance' });

  if (raw.startsWith('ACCESS_BALANCE:')) {
    return { ok: true, balance: raw.split(':')[1] };
  }

  // Fallback jika gateway mengembalikan JSON
  if (raw.startsWith('{')) {
    try {
      const json = JSON.parse(raw);
      const balance = json?.data?.balance ?? json?.balance;
      if (balance !== undefined) {
        return { ok: true, balance: String(balance), currency: json?.data?.currency };
      }
    } catch {
      // Abaikan, lanjut ke error
    }
  }

  return { ok: false, raw, error: translateGrizzlyError(raw) };
}

export async function getPrices(service, country) {
  const params = { action: 'getPrices' };
  if (service) params.service = String(service).toLowerCase();
  if (country !== undefined && country !== null && country !== '') {
    params.country = String(country);
  }

  const raw = await callGrizzly(params);
  if (!raw.startsWith('{') && !raw.startsWith('[')) {
    return { ok: false, raw, error: translateGrizzlyError(raw) };
  }

  try {
    const data = JSON.parse(raw);
    return { ok: true, data };
  } catch {
    return { ok: false, raw, error: 'Gagal membaca data harga dari GrizzlySMS.' };
  }
}

export async function getOperators(country) {
  const params = { action: 'getOperators' };
  if (country !== undefined && country !== null && country !== '') {
    params.country = String(country);
  }

  try {
    const raw = await callGrizzly(params);
    if (!raw.startsWith('{') && !raw.startsWith('[')) {
      return { ok: false, operators: [], raw, error: translateGrizzlyError(raw) };
    }

    const parsed = JSON.parse(raw);
    const countryKey = String(country);
    let list = [];

    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed?.countryOperators) {
      const entry = parsed.countryOperators[countryKey];
      if (Array.isArray(entry)) {
        list = entry;
      } else if (entry && typeof entry === 'object') {
        list = Object.keys(entry);
      }
    } else if (parsed?.[countryKey]) {
      const entry = parsed[countryKey];
      if (Array.isArray(entry)) {
        list = entry;
      } else if (entry && typeof entry === 'object') {
        list = Object.keys(entry);
      }
    }

    const normalized = [...new Set(list.map((op) => String(op).trim()).filter(Boolean))].filter(
      (op) => op.toLowerCase() !== 'any'
    );

    return { ok: true, operators: normalized };
  } catch (err) {
    return { ok: false, operators: [], error: err.message };
  }
}

export async function getNumber({
  service,
  country,
  operator,
  maxPrice,
  providerIds,
  exceptProviderIds,
  phoneException,
}) {
  const { defaultProviderIds, defaultExceptProviderIds } = getEnvConfig();
  const normalizedOp = normalizeOperatorCode(operator);
  const params = {
    action: 'getNumber',
    service: String(service).toLowerCase(),
    country: String(country),
  };
  if (normalizedOp && normalizedOp !== 'any') {
    params.operator = normalizedOp;
  }

  // Filter prefix (phoneException) agar GrizzlySMS wajib mengirim operator yang sesuai (khusus Indonesia)
  const effectivePhoneException = (
    phoneException ?? getIndonesiaPhoneException(country, normalizedOp)
  ).trim();
  if (effectivePhoneException) {
    params.phoneException = effectivePhoneException;
  }

  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
    params.maxPrice = String(maxPrice);
  }
  const effectiveProviderIds = (providerIds ?? defaultProviderIds ?? '').trim();
  if (effectiveProviderIds) {
    params.providerIds = effectiveProviderIds;
  }
  const effectiveExceptProviderIds = (exceptProviderIds ?? defaultExceptProviderIds ?? '').trim();
  if (effectiveExceptProviderIds) {
    params.exceptProviderIds = effectiveExceptProviderIds;
  }

  const raw = await callGrizzly(params);

  if (raw.startsWith('ACCESS_NUMBER:')) {
    const [, id, phone] = raw.split(':');
    return { ok: true, id, phone };
  }

  return { ok: false, raw, error: translateGrizzlyError(raw) };
}

export async function getStatus(id) {
  const raw = await callGrizzly({ action: 'getStatus', id });

  if (raw === 'STATUS_WAIT_CODE') {
    return { ok: true, state: 'WAIT_CODE', message: 'Menunggu SMS masuk...' };
  }
  if (raw.startsWith('STATUS_WAIT_RETRY:')) {
    const lastCode = raw.slice('STATUS_WAIT_RETRY:'.length);
    return {
      ok: true,
      state: 'WAIT_RETRY',
      code: lastCode,
      message: `Menunggu SMS ulang (kode sebelumnya: ${lastCode})`,
    };
  }
  if (raw.startsWith('STATUS_OK:')) {
    const code = raw.slice('STATUS_OK:'.length);
    return { ok: true, state: 'OK', code, message: 'Kode OTP diterima!' };
  }
  if (raw === 'STATUS_CANCEL') {
    return { ok: true, state: 'CANCEL', message: 'Aktivasi telah dibatalkan.' };
  }

  return { ok: false, raw, error: translateGrizzlyError(raw) };
}

/**
 * status:
 * 1 = SMS sudah dikirim (ready)
 * 3 = Minta SMS tambahan
 * 6 = Selesaikan aktivasi
 * 8 = Batalkan aktivasi (refund)
 */
export async function setStatus(id, status) {
  const raw = await callGrizzly({ action: 'setStatus', id, status });

  const successMap = {
    ACCESS_READY: 'Status diperbarui: siap menerima SMS.',
    ACCESS_RETRY_GET: 'Permintaan SMS tambahan berhasil dikirim. Tunggu SMS baru masuk.',
    ACCESS_ACTIVATION: 'Aktivasi selesai! Terima kasih.',
    ACCESS_FINISH: 'Aktivasi selesai! Terima kasih.',
    ACCESS_CANCEL: 'Aktivasi dibatalkan. Saldo akan dikembalikan otomatis jika belum ada SMS.',
    ACCESS_ACTIVATION_CANCEL:
      'Aktivasi dibatalkan. Saldo akan dikembalikan otomatis jika belum ada SMS.',
  };

  if (successMap[raw]) {
    return { ok: true, raw, message: successMap[raw] };
  }

  // Fallback cancel GrizzlySMS: coba status=-1 jika status=8 tidak langsung berhasil (dan bukan EARLY_CANCEL_DENIED)
  if (Number(status) === 8 && raw !== 'EARLY_CANCEL_DENIED') {
    const altRaw = await callGrizzly({ action: 'setStatus', id, status: -1 });
    if (successMap[altRaw]) {
      return { ok: true, raw: altRaw, message: successMap[altRaw] };
    }
  }

  return { ok: false, raw, error: translateGrizzlyError(raw) };
}

function parseActivationTimestampMs(item) {
  const rawTime = item?.time ?? item?.createdAt ?? item?.activationTimestamp;
  if (rawTime !== undefined && rawTime !== null && /^\d+$/.test(String(rawTime).trim())) {
    const num = Number(String(rawTime).trim());
    return num < 1e12 ? num * 1000 : num;
  }

  const rawDate = item?.activationTime;
  if (typeof rawDate === 'string' && rawDate.trim()) {
    const trimmed = rawDate.trim();
    // Jika format "YYYY-MM-DD HH:mm:ss" tanpa timezone, parse sebagai UTC
    const iso = trimmed.includes('T') ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return null;
}

export async function getActiveActivations() {
  const raw = await callGrizzly({ action: 'getActiveActivations' });

  if (raw === 'NO_ACTIVATIONS') {
    return { ok: true, activations: [] };
  }

  if (!raw.startsWith('{') && !raw.startsWith('[')) {
    return { ok: false, activations: [], raw, error: translateGrizzlyError(raw) };
  }

  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.activeActivations)
        ? parsed.activeActivations
        : Array.isArray(parsed?.data)
          ? parsed.data
          : [];

    const activations = list
      .map((item) => {
        const id = String(item?.activationId ?? item?.id ?? '').trim();
        if (!id) return null;

        let smsCode = null;
        if (Array.isArray(item?.smsCode) && item.smsCode.length > 0) {
          smsCode = String(item.smsCode[item.smsCode.length - 1]);
        } else if (typeof item?.smsCode === 'string' && item.smsCode.trim()) {
          smsCode = item.smsCode.trim();
        }

        return {
          id,
          phone: String(item?.phoneNumber ?? item?.phone ?? '').trim(),
          service: String(item?.serviceCode ?? item?.service ?? '').trim(),
          country: String(item?.countryCode ?? item?.country ?? '').trim(),
          cost: item?.activationCost ?? item?.cost ?? null,
          status: item?.activationStatus !== undefined ? String(item.activationStatus) : null,
          smsCode,
          createdAt: parseActivationTimestampMs(item),
        };
      })
      .filter(Boolean);

    return { ok: true, activations };
  } catch {
    return {
      ok: false,
      activations: [],
      raw,
      error: 'Gagal membaca daftar aktivasi aktif dari GrizzlySMS.',
    };
  }
}
