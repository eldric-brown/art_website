import {
  isAllowedImageUrl,
  json,
  methodNotAllowed
} from '../../_lib/http.js';

const MAX_ITEMS = 50;

// 前台展示用的完整列表
const SELECT_ALL = `SELECT id, title, date_text, location, image, sort_order,
                           created_at, updated_at
                    FROM meetup_items
                    ORDER BY sort_order DESC, id DESC`;

// 逐条校验，错误信息带上序号，后台定位更快。
function validateItems(body) {
  if (!Array.isArray(body) || body.length === 0) {
    return { errors: ['items 必须是非空数组'], items: [] };
  }
  if (body.length > MAX_ITEMS) {
    return { errors: [`一次最多保存 ${MAX_ITEMS} 条`], items: [] };
  }

  const errors = [];
  const items = [];

  for (let index = 0; index < body.length; index += 1) {
    const raw = body[index] && typeof body[index] === 'object' ? body[index] : {};
    const prefix = `第 ${index + 1} 条`;

    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!title) errors.push(`${prefix} title 不能为空`);
    else if (title.length > 120) errors.push(`${prefix} title 不能超过 120 个字符`);

    const dateText = typeof raw.date_text === 'string' ? raw.date_text.trim() : '';
    if (dateText.length > 80) errors.push(`${prefix} date_text 不能超过 80 个字符`);

    const location = typeof raw.location === 'string' ? raw.location.trim() : '';
    if (location.length > 200) errors.push(`${prefix} location 不能超过 200 个字符`);

    const image = typeof raw.image === 'string' ? raw.image.trim() : '';
    if (!isAllowedImageUrl(image, { allowEmpty: true })) {
      errors.push(`${prefix} image 不是有效的图片地址`);
    }

    const sortOrder = raw.sort_order ?? 0;
    if (!Number.isInteger(sortOrder) || sortOrder < -1000000 || sortOrder > 1000000) {
      errors.push(`${prefix} sort_order 必须是 -1000000 到 1000000 的整数`);
    }

    items.push({ title, date_text: dateText, location, image, sort_order: sortOrder });
  }

  return { errors, items };
}

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD', 'PUT'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD', 'PUT']);
  }

  try {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const { results } = await env.DB.prepare(SELECT_ALL).all();
      return json({ ok: true, data: { items: results } });
    }

    // PUT：整体替换。用 batch 保证「删旧 + 插新」在一次事务里完成，
    // 中途失败不会出现空列表。
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }

    const { errors, items } = validateItems(body.items);
    if (errors.length > 0) {
      return json({ ok: false, error: 'validation_failed', details: errors }, 422);
    }

    const statements = [env.DB.prepare('DELETE FROM meetup_items')];
    for (const item of items) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO meetup_items (title, date_text, location, image, sort_order)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(item.title, item.date_text, item.location, item.image, item.sort_order)
      );
    }
    await env.DB.batch(statements);

    const { results } = await env.DB.prepare(SELECT_ALL).all();
    return json({
      ok: true,
      data: { items: results },
      message: `已保存 ${items.length} 条活动`
    });
  } catch (error) {
    console.error('meetup endpoint failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '活动保存失败'
    }, 500);
  }
}
