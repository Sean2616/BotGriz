import { getEnvConfig } from './config.js';

const ACTIVE_ORDERS_KEY = 'grizzly:active_orders';

export function isStoreConfigured() {
  const { redisUrl, redisToken } = getEnvConfig();
  return Boolean(redisUrl && redisToken);
}

async function redisCommand(command) {
  const { redisUrl, redisToken } = getEnvConfig();
  if (!redisUrl || !redisToken) {
    return null;
  }

  const res = await fetch(redisUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Redis REST error (${res.status}): ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Redis command error: ${data.error}`);
  }
  return data.result;
}

export async function saveActiveOrder(order) {
  if (!isStoreConfigured()) return false;
  await redisCommand(['HSET', ACTIVE_ORDERS_KEY, String(order.id), JSON.stringify(order)]);
  return true;
}

export async function removeActiveOrder(id) {
  if (!isStoreConfigured()) return false;
  await redisCommand(['HDEL', ACTIVE_ORDERS_KEY, String(id)]);
  return true;
}

export async function getActiveOrders() {
  if (!isStoreConfigured()) return [];
  const raw = await redisCommand(['HGETALL', ACTIVE_ORDERS_KEY]);
  if (!raw) return [];

  const orders = [];
  if (Array.isArray(raw)) {
    // Format REST standar: [field1, value1, field2, value2, ...]
    for (let i = 0; i < raw.length; i += 2) {
      try {
        orders.push(JSON.parse(raw[i + 1]));
      } catch {
        // Abaikan entri rusak
      }
    }
  } else if (typeof raw === 'object') {
    for (const value of Object.values(raw)) {
      try {
        orders.push(typeof value === 'string' ? JSON.parse(value) : value);
      } catch {
        // Abaikan entri rusak
      }
    }
  }

  return orders.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}
