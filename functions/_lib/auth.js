const COOKIE_NAME = 'art_session';
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const encoder = new TextEncoder();

function getSessionSecret(env) {
  const secret = env.SESSION_SECRET || env.ADMIN_PASSWORD;
  return typeof secret === 'string' && secret.length >= 8 ? secret : '';
}

function randomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacBytes(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return new Uint8Array(signature);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a[index] ^ b[index];
  }
  return difference === 0;
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    if (key === name) return part.slice(separator + 1).trim();
  }

  return '';
}

function isSecureRequest(request) {
  return new URL(request.url).protocol === 'https:';
}

function serializeCookie(token, request, maxAge) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
    'Priority=High'
  ];

  if (isSecureRequest(request)) parts.push('Secure');
  return parts.join('; ');
}

async function sha256Bytes(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return new Uint8Array(digest);
}

export async function secureStringEqual(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  const [inputHash, expectedHash] = await Promise.all([
    sha256Bytes(input),
    sha256Bytes(expected)
  ]);
  return timingSafeEqual(inputHash, expectedHash);
}

export async function createSessionCookie(request, env) {
  const secret = getSessionSecret(env);
  if (!secret) throw new Error('SESSION_SECRET or ADMIN_PASSWORD is not configured');

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${expiresAt}.${randomHex(16)}`;
  const signature = bytesToHex(await hmacBytes(payload, secret));
  const token = `${payload}.${signature}`;

  return serializeCookie(token, request, SESSION_TTL_SECONDS);
}

export function clearSessionCookie(request) {
  return serializeCookie('', request, 0);
}

export async function hasValidSession(request, env) {
  const secret = getSessionSecret(env);
  if (!secret) return false;

  const token = getCookie(request, COOKIE_NAME);
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [expiresRaw, nonce, providedSignature] = parts;
  const expiresAt = Number(expiresRaw);
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isInteger(expiresAt) || expiresAt <= now || expiresAt > now + SESSION_TTL_SECONDS + 300) {
    return false;
  }
  if (!/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(providedSignature)) {
    return false;
  }

  try {
    const expectedSignature = await hmacBytes(`${expiresRaw}.${nonce}`, secret);
    const providedBytes = new Uint8Array(
      providedSignature.match(/.{2}/g).map((hex) => parseInt(hex, 16))
    );
    return timingSafeEqual(expectedSignature, providedBytes);
  } catch {
    return false;
  }
}