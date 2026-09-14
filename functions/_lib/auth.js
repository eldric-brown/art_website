const COOKIE_NAME = 'art_session';
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const PBKDF2_ITERATIONS = 100000;
const PASSWORD_KEY_BYTES = 32;
const PASSWORD_SALT_BYTES = 16;
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

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value) {
  if (typeof value !== 'string' || !value) throw new Error('invalid base64url value');
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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

async function derivePassword(password, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64UrlToBytes(salt),
      iterations
    },
    material,
    PASSWORD_KEY_BYTES * 8
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

export async function createPasswordRecord(password) {
  const saltBytes = new Uint8Array(PASSWORD_SALT_BYTES);
  crypto.getRandomValues(saltBytes);
  const salt = bytesToBase64Url(saltBytes);
  const hash = await derivePassword(password, salt, PBKDF2_ITERATIONS);
  return {
    hash,
    salt,
    iterations: PBKDF2_ITERATIONS,
    algorithm: 'PBKDF2-SHA256'
  };
}

export async function verifyPassword(password, user) {
  if (!user || typeof password !== 'string') return false;
  if (user.password_algo && user.password_algo !== 'PBKDF2-SHA256') return false;
  const iterations = Number(user.password_iterations);
  if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 100000) return false;

  try {
    const actual = base64UrlToBytes(await derivePassword(password, user.password_salt, iterations));
    const expected = base64UrlToBytes(user.password_hash);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function secureStringEqual(input, expected) {
  if (typeof input !== 'string' || typeof expected !== 'string') return false;
  const [inputHash, expectedHash] = await Promise.all([
    sha256Bytes(input),
    sha256Bytes(expected)
  ]);
  return timingSafeEqual(inputHash, expectedHash);
}

export async function createSessionCookie(request, env, userId) {
  const secret = getSessionSecret(env);
  if (!secret) throw new Error('SESSION_SECRET or ADMIN_PASSWORD is not configured');
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('invalid user id');

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${expiresAt}.${randomHex(16)}.${userId}`;
  const signature = bytesToHex(await hmacBytes(payload, secret));
  const token = `${payload}.${signature}`;

  return serializeCookie(token, request, SESSION_TTL_SECONDS);
}

export function clearSessionCookie(request) {
  return serializeCookie('', request, 0);
}

async function readSession(request, env) {
  const secret = getSessionSecret(env);
  if (!secret) return null;

  const token = getCookie(request, COOKIE_NAME);
  const parts = token.split('.');
  if (parts.length !== 4) return null;

  const [expiresRaw, nonce, userIdRaw, providedSignature] = parts;
  const expiresAt = Number(expiresRaw);
  const userId = Number(userIdRaw);
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isInteger(expiresAt) || expiresAt <= now || expiresAt > now + SESSION_TTL_SECONDS + 300) {
    return null;
  }
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  if (!/^[a-f0-9]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(providedSignature)) {
    return null;
  }

  try {
    const expectedSignature = await hmacBytes(`${expiresRaw}.${nonce}.${userIdRaw}`, secret);
    const providedBytes = new Uint8Array(
      providedSignature.match(/.{2}/g).map((hex) => parseInt(hex, 16))
    );
    if (!timingSafeEqual(expectedSignature, providedBytes)) return null;
    return { userId, expiresAt };
  } catch {
    return null;
  }
}

export async function getSessionUserId(request, env) {
  const session = await readSession(request, env);
  return session ? session.userId : null;
}

export async function hasValidSession(request, env) {
  return Boolean(await readSession(request, env));
}
