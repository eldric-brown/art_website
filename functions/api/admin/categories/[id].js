import {
  isAllowedImageUrl,
  json,
  methodNotAllowed
} from '../../../_lib/http.js';

const SELECT_ONE = `SELECT id, key, name, image, sort_order, enabled, created_at, updated_at
                    FROM categories WHERE id = ?`;

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function normalizeSortOrder(value, label, errors, data) {
  if (!Number.isInteger(value) || value < -1000000 || value > 1000000) {
    errors.push(`${label} 必须是 -1000000 到 1000000 的整数`);
    return;
  }
  data.sort_order = value;
}

function normalizeEnabled(value, label, errors, data) {
  if (value === true || value === 1 || value === '1') data.enabled = 1;
  else if (value === false || value === 0 || value === '0') data.enabled = 0;
  else errors.push(`${label} 必须是 0 或 1`);
}

export async function onRequest({ request, env, params }) {
  const id = Number(params.id);
  if (!/^\d+$/.test(String(params.id || '')) || !Number.isSafeInteger(id) || id <= 0) {
    return json({ ok: false, error: 'invalid_id' }, 400);
  }

  if (request.method === 'PATCH') return handlePatch(id, request, env);
  if (request.method === 'DELETE') return handleDelete(id, env);
  return methodNotAllowed(['PATCH', 'DELETE']);
}

async function handlePatch(id, request, env) {
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
  const data = {};

  // key 刻意不在可改字段里：改名会让 artworks.category 指向失效。
  // 需要改 key 请「先为名下作品换栏目 → 删除本栏目 → 用新 key 重建」。
  if (hasOwn(body, 'name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) errors.push('name 不能为空');
    else if (name.length > 60) errors.push('name 不能超过 60 个字符');
    else data.name = name;
  }

  if (hasOwn(body, 'image')) {
    const image = typeof body.image === 'string' ? body.image.trim() : '';
    if (!isAllowedImageUrl(image, { allowEmpty: true })) {
      errors.push('image 不是有效的图片地址');
    } else {
      data.image = image;
    }
  }

  if (hasOwn(body, 'sort_order')) normalizeSortOrder(body.sort_order, 'sort_order', errors, data);
  if (hasOwn(body, 'enabled')) normalizeEnabled(body.enabled, 'enabled', errors, data);

  if (errors.length > 0) {
    return json({ ok: false, error: 'validation_failed', details: errors }, 422);
  }
  if (Object.keys(data).length === 0) {
    return json({ ok: false, error: 'no_fields_to_update' }, 400);
  }

  try {
    const setClauses = Object.keys(data).map((key) => `${key} = ?`);
    const values = [...Object.values(data), id];

    const result = await env.DB.prepare(
      `UPDATE categories SET ${setClauses.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    if (result.meta.changes === 0) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    const { results } = await env.DB.prepare(SELECT_ONE).bind(id).all();
    return json({ ok: true, data: { category: results[0] }, message: '更新成功' });
  } catch (error) {
    console.error('patch category failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '栏目更新失败'
    }, 500);
  }
}

// 删除前校验是否还有作品引用该栏目，避免产生孤儿分类。
async function handleDelete(id, env) {
  try {
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) AS n
       FROM artworks a
       WHERE a.category = (SELECT key FROM categories WHERE id = ?)`
    ).bind(id).first();
    const referenced = Number((countResult && countResult.n) || 0);

    if (referenced > 0) {
      return json({
        ok: false,
        error: 'category_in_use',
        message: `该栏目下还有 ${referenced} 件作品，请先为它们选择其他栏目`
      }, 409);
    }

    const result = await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
    if (result.meta.changes === 0) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    return json({ ok: true, message: '删除成功' });
  } catch (error) {
    console.error('delete category failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '栏目删除失败'
    }, 500);
  }
}
