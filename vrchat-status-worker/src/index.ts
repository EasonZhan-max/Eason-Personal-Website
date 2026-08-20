import { timingSafeEqual } from 'node:crypto';

const STATUS_KEY = 'vrchat-status:v1';
const MAX_BODY_BYTES = 24 * 1024;
const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;
const textEncoder = new TextEncoder();

type JsonObject = Record<string, unknown>;

type MediaItem = {
  name: string;
  image: string;
};

type GroupItem = {
  name: string;
  icon: string;
};

type StatusRecord = {
  online: boolean;
  status: string;
  status_description: string;
  display_name: string;
  pronouns: string;
  bio: string;
  avatar_url: string;
  cover_url: string;
  badges: MediaItem[];
  groups: GroupItem[];
  world_label: string;
  world_started_at: string;
  received_at_ms: number;
  signature_timestamp_ms: number;
};

class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cleanText = (value: unknown, maxLength: number): string =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const cleanHttpsUrl = (value: unknown): string => {
  const text = cleanText(value, 2048);
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
};

const cleanDate = (value: unknown): string => {
  const text = cleanText(value, 64);
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp)) return '';
  const now = Date.now();
  if (timestamp > now + SIGNATURE_WINDOW_MS || timestamp < now - 7 * 24 * 60 * 60 * 1000) return '';
  return new Date(timestamp).toISOString();
};

const cleanStatus = (value: unknown, online: boolean): string => {
  if (!online) return 'offline';
  const status = cleanText(value, 24).toLowerCase();
  return ['active', 'join me', 'ask me', 'busy'].includes(status) ? status : 'active';
};

const cleanWorldLabel = (value: unknown): string => {
  const world = cleanText(value, 120);
  return /wrld_[0-9a-f-]+|~|nonce|region\(/i.test(world) ? '私人世界' : world;
};

const cleanBadges = (value: unknown): MediaItem[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((item) => {
    if (!isObject(item)) return [];
    const name = cleanText(item.name, 80);
    const image = cleanHttpsUrl(item.image);
    return name && image ? [{ name, image }] : [];
  });
};

const cleanGroups = (value: unknown): GroupItem[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap((item) => {
    if (!isObject(item)) return [];
    const name = cleanText(item.name, 80);
    const icon = cleanHttpsUrl(item.icon);
    return name ? [{ name, icon }] : [];
  });
};

const normalizePayload = (value: unknown): Omit<StatusRecord, 'received_at_ms' | 'signature_timestamp_ms'> => {
  if (!isObject(value)) throw new HttpError(400, 'invalid_payload', 'JSON body must be an object');
  const online = value.online === true;
  const worldLabel = online ? cleanWorldLabel(value.world_label) : '';
  return {
    online,
    status: cleanStatus(value.status, online),
    status_description: online ? cleanText(value.status_description, 100) : '',
    display_name: cleanText(value.display_name, 64) || 'EasonZhan',
    pronouns: cleanText(value.pronouns, 32),
    bio: cleanText(value.bio, 700),
    avatar_url: cleanHttpsUrl(value.avatar_url),
    cover_url: cleanHttpsUrl(value.cover_url),
    badges: cleanBadges(value.badges),
    groups: cleanGroups(value.groups),
    world_label: worldLabel,
    world_started_at: worldLabel ? cleanDate(value.world_started_at) : ''
  };
};

const normalizeStored = (value: unknown): StatusRecord | null => {
  if (!isObject(value)) return null;
  const receivedAt = typeof value.received_at_ms === 'number' ? value.received_at_ms : Number.NaN;
  const signatureTimestamp = typeof value.signature_timestamp_ms === 'number' ? value.signature_timestamp_ms : Number.NaN;
  if (!Number.isFinite(receivedAt) || !Number.isFinite(signatureTimestamp)) return null;
  try {
    return {
      ...normalizePayload(value),
      received_at_ms: receivedAt,
      signature_timestamp_ms: signatureTimestamp
    };
  } catch {
    return null;
  }
};

const baseHeaders = (): Headers => {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Status-Timestamp, X-Status-Signature');
  headers.set('Cache-Control', 'no-store, max-age=0');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  return headers;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: baseHeaders() });

const readBoundedText = async (request: Request): Promise<string> => {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large', 'Payload is too large');
  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let output = '';
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    bytes += result.value.byteLength;
    if (bytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new HttpError(413, 'payload_too_large', 'Payload is too large');
    }
    output += decoder.decode(result.value, { stream: true });
  }
  output += decoder.decode();
  return output;
};

const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const verifySignature = async (request: Request, body: string, env: Env): Promise<number> => {
  const timestampText = request.headers.get('X-Status-Timestamp') || '';
  const signatureText = request.headers.get('X-Status-Signature') || '';
  if (!/^\d{13}$/.test(timestampText) || !/^[0-9a-f]{64}$/i.test(signatureText)) {
    throw new HttpError(401, 'invalid_signature', 'Missing or invalid request signature');
  }

  const timestamp = Number(timestampText);
  if (Math.abs(Date.now() - timestamp) > SIGNATURE_WINDOW_MS) {
    throw new HttpError(401, 'expired_signature', 'Request signature has expired');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(env.UPLOAD_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expected = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`${timestampText}\n${body}`));
  const provided = hexToBytes(signatureText);
  if (!timingSafeEqual(new Uint8Array(expected), provided)) {
    throw new HttpError(401, 'invalid_signature', 'Missing or invalid request signature');
  }
  return timestamp;
};

const statusTtlSeconds = (env: Env): number => {
  const parsed = Number(env.STATUS_TTL_SECONDS);
  return Number.isFinite(parsed) ? Math.min(600, Math.max(60, Math.floor(parsed))) : 100;
};

const getPublicStatus = async (env: Env): Promise<Response> => {
  const raw = await env.STATUS_KV.get<unknown>(STATUS_KEY, 'json');
  const stored = normalizeStored(raw);
  if (!stored) {
    return jsonResponse({
      success: true,
      data: { configured: false, available: true, online: false, updated_at: '', profile: null }
    });
  }

  const now = Date.now();
  const online = stored.online && now - stored.received_at_ms <= statusTtlSeconds(env) * 1000;
  const sessionSeconds = online && stored.world_started_at
    ? Math.max(0, Math.floor((now - Date.parse(stored.world_started_at)) / 1000))
    : undefined;

  const profile: JsonObject = {
    display_name: stored.display_name,
    status: online ? stored.status : 'offline',
    status_description: online ? stored.status_description : '',
    pronouns: stored.pronouns,
    bio: stored.bio,
    avatar_url: stored.avatar_url,
    cover_url: stored.cover_url,
    badges: stored.badges,
    groups: stored.groups
  };
  if (online && stored.world_label) {
    profile.world_label = stored.world_label;
    profile.world_started_at = stored.world_started_at;
    profile.session_seconds = sessionSeconds;
  }

  return jsonResponse({
    success: true,
    data: {
      configured: true,
      available: true,
      online,
      updated_at: new Date(stored.received_at_ms).toISOString(),
      profile
    }
  });
};

const updateStatus = async (request: Request, env: Env): Promise<Response> => {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json');
  }
  const body = await readBoundedText(request);
  const signatureTimestamp = await verifySignature(request, body, env);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body is not valid JSON');
  }

  const previous = normalizeStored(await env.STATUS_KV.get<unknown>(STATUS_KEY, 'json'));
  if (previous && signatureTimestamp <= previous.signature_timestamp_ms) {
    throw new HttpError(409, 'replayed_request', 'Request timestamp is not newer than the stored state');
  }

  const record: StatusRecord = {
    ...normalizePayload(parsed),
    received_at_ms: Date.now(),
    signature_timestamp_ms: signatureTimestamp
  };
  await env.STATUS_KV.put(STATUS_KEY, JSON.stringify(record));
  console.log(JSON.stringify({ event: 'status_updated', online: record.online, body_bytes: body.length }));
  return jsonResponse({ success: true, received_at: new Date(record.received_at_ms).toISOString() }, 202);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: baseHeaders() });

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return jsonResponse({ success: true, service: 'eason-vrchat-status' });
      }
      if (url.pathname === '/status' && request.method === 'GET') return await getPublicStatus(env);
      if (url.pathname === '/status' && request.method === 'POST') return await updateStatus(request, env);
      return jsonResponse({ success: false, error: 'not_found' }, 404);
    } catch (error) {
      const httpError = error instanceof HttpError
        ? error
        : new HttpError(500, 'internal_error', 'Internal server error');
      if (!(error instanceof HttpError)) {
        console.error(JSON.stringify({ event: 'request_failed', path: url.pathname, error: error instanceof Error ? error.message : String(error) }));
      }
      return jsonResponse({ success: false, error: httpError.code, message: httpError.message }, httpError.status);
    }
  }
} satisfies ExportedHandler<Env>;
