import {
  isAllowedImageUrl,
  json,
  methodNotAllowed
} from '../../../_lib/http.js';

// key 建后不可改：改 key 会让 artworks.category 指向失效。
const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const errors = [];

  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!KEY_RE.test(key)) {
    errors.push('key 需以小写字母开头，仅含小写字母/数字/下划线，最长 40 字符');
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) errors.push('name 不能为空');
  else if (name.length > 60) errors.push('name 不能超过 60 个字符');

  const image = typeof body.image === 'string' ? body.image.trim() : '';
  if (!isAllowedImageUrl(image, { allowEmpty: true })) {
    errors.push('image 不是有效的图片地址');
  }

  const sortOrder = body.sort_order ?? 0;
  if (!Number.isInteger(sortOrder) || sortOrder < -1000000 || sortOrder > 1000000) {
    errors.push('sort_order 必须是 -1000000 到 1000000 的整数');
  }

  if (errors.length > 0) {
    return json({ ok: false, error: 'validation_failed', details: errors }, 422);
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO categories (key, name, image, sort_order, enabled)
       VALUES (?, ?, ?, ?, 1)`
    ).bind(key, name, image, sortOrder).run();

    const { results } = await env.DB.prepare(
      `SELECT id, key, name, image, sort_order, enabled, created_at, updated_at
       FROM categories WHERE id = ?`
    ).bind(result.meta.last_row_id).all();

    return json({
      ok: true,
      data: { category: results[0] },
      message: '栏目创建成功'
    }, 201);
  } catch (error) {
    if (String((error && error.message) || '').includes('UNIQUE constraint failed')) {
      return json({
        ok: false,
        error: 'duplicate_key',
        message: '该栏目 key 已存在'
      }, 409);
    }
    console.error('create category failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '栏目创建失败'
    }, 500);
  }
}
