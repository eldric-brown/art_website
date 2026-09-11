import { json, methodNotAllowed } from '../../_lib/http.js';

// key 命名约束：形如 'page.block.item'，允许字母/数字/点/下划线/连字符
const KEY_RE = /^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*$/;
const MAX_VALUE_LENGTH = 2000;
const MAX_KEYS_PER_REQUEST = 300;

function validateSiteContent(body) {
  const errors = [];
  const data = {};

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['request body must be a JSON object'], data };
  }

  const keys = Object.keys(body);
  if (keys.length === 0) {
    return { errors: ['no fields to update'], data };
  }
  if (keys.length > MAX_KEYS_PER_REQUEST) {
    return { errors: ['too many keys in one request (max ' + MAX_KEYS_PER_REQUEST + ')'], data };
  }

  for (const key of keys) {
    if (!KEY_RE.test(key)) {
      errors.push('invalid key: ' + key);
      continue;
    }
    const value = body[key];
    if (typeof value !== 'string') {
      errors.push(key + ' must be a string');
      continue;
    }
    if (value.length > MAX_VALUE_LENGTH) {
      errors.push(key + ' exceeds ' + MAX_VALUE_LENGTH + ' characters');
      continue;
    }
    data[key] = value;
  }

  return { errors, data };
}

export async function onRequest({ request, env }) {
  if (!['GET', 'PUT'].includes(request.method)) {
    return methodNotAllowed(['GET', 'PUT']);
  }

  try {
    if (request.method === 'GET') {
      const rows = await env.DB.prepare(
        `SELECT key, value, updated_at FROM site_content ORDER BY key`
      ).all();

      const content = {};
      for (const row of rows.results) {
        content[row.key] = { value: row.value, updated_at: row.updated_at };
      }
      return json({ ok: true, data: { content } });
    }

    // PUT
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }

    const { errors, data } = validateSiteContent(body);
    if (errors.length) {
      return json({ ok: false, error: 'validation_failed', details: errors }, 422);
    }

    // 批量 upsert（SQLite UPSERT 语法）
    for (const [key, value] of Object.entries(data)) {
      await env.DB.prepare(
        `INSERT INTO site_content (key, value, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).bind(key, value).run();
    }

    // 回读完整内容
    const rows = await env.DB.prepare(
      `SELECT key, value, updated_at FROM site_content ORDER BY key`
    ).all();

    const content = {};
    for (const row of rows.results) {
      content[row.key] = { value: row.value, updated_at: row.updated_at };
    }

    return json({ ok: true, data: { content, updated: Object.keys(data).length } });
  } catch (error) {
    console.error('site content endpoint failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: 'site content save failed'
    }, 500);
  }
}
