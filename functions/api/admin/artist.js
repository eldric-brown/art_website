import { json, methodNotAllowed, safeParseJSON } from '../../_lib/http.js';

const STRING_FIELDS = {
  name: 100,
  name_en: 100,
  bio: 10000,
  bio_short: 300,
  avatar: 2048,
  signature: 2048,
  contact_email: 320,
  contact_wechat: 100
};

function isAllowedUrl(value, allowRelativeR2) {
  if (!value) return true;
  if (allowRelativeR2 && /^\/r2\/artworks\/[A-Za-z0-9._/-]+$/.test(value) && !value.includes('..')) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}

function validateArtist(body) {
  const errors = [];
  const data = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['请求体必须是 JSON 对象'], data };
  }

  for (const [field, maxLength] of Object.entries(STRING_FIELDS)) {
    if (!(field in body)) continue;
    if (typeof body[field] !== 'string') {
      errors.push(`${field} 必须是字符串`);
      continue;
    }

    const value = body[field].trim();
    if (value.length > maxLength) {
      errors.push(`${field} 不能超过 ${maxLength} 个字符`);
      continue;
    }
    data[field] = value;
  }

  if ('name' in body && !data.name) errors.push('name 不能为空');
  if (data.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact_email)) {
    errors.push('contact_email 格式不正确');
  }
  if (data.avatar && !isAllowedUrl(data.avatar, true)) {
    errors.push('avatar 必须是 HTTPS URL 或站内 /r2/artworks/ 地址');
  }
  if (data.signature && !isAllowedUrl(data.signature, true)) {
    errors.push('signature 必须是 HTTPS URL 或站内 /r2/artworks/ 地址');
  }

  if ('socials' in body) {
    if (!body.socials || typeof body.socials !== 'object' || Array.isArray(body.socials)) {
      errors.push('socials 必须是 JSON 对象');
    } else {
      const entries = Object.entries(body.socials);
      if (entries.length > 20) errors.push('socials 最多包含 20 个平台');

      const socials = Object.create(null);
      for (const [key, value] of entries) {
        if (!key || key.length > 50 || ['__proto__', 'prototype', 'constructor'].includes(key)) {
          errors.push('socials 中包含无效的平台名称');
          break;
        }
        if (typeof value !== 'string' || value.length > 2048) {
          errors.push(`socials.${key} 必须是 2048 字符以内的字符串`);
          break;
        }
        if (value && !isAllowedUrl(value, false)) {
          errors.push(`socials.${key} 必须是 HTTPS URL`);
          break;
        }
        socials[key] = value.trim();
      }

      if (errors.length === 0) data.socials = socials;
    }
  }

  return { errors, data };
}

export async function onRequest({ request, env }) {
  if (request.method !== 'PUT') return methodNotAllowed(['PUT']);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const { errors, data } = validateArtist(body);
  if (errors.length) {
    return json({ ok: false, error: 'validation_failed', details: errors }, 422);
  }

  const keys = Object.keys(data);
  if (keys.length === 0) {
    return json({ ok: false, error: 'no_fields' }, 400);
  }

  try {
    const sets = keys.map((key) => `${key} = ?`);
    const values = keys.map((key) => key === 'socials' ? JSON.stringify(data[key]) : data[key]);
    sets.push("updated_at = datetime('now')");
    values.push(1);

    await env.DB.prepare(
      `UPDATE artist SET ${sets.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    const row = await env.DB.prepare(
      `SELECT id, name, name_en, bio, bio_short, avatar, signature, socials,
              contact_email, contact_wechat, updated_at
       FROM artist WHERE id = 1`
    ).first();

    return json({
      ok: true,
      data: { ...row, socials: safeParseJSON(row.socials, {}) }
    });
  } catch (error) {
    console.error('update artist failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '艺术家资料保存失败'
    }, 500);
  }
}