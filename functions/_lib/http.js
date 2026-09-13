export const CATEGORY_KEYS = new Set([
  'oil',
  'watercolor',
  'sketch',
  'ink',
  'digital',
  'photograph',
  'other'
]);

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

export function methodNotAllowed(allowedMethods) {
  return json(
    { ok: false, error: 'method_not_allowed' },
    405,
    { Allow: allowedMethods.join(', ') }
  );
}

export function safeParseJSON(value, fallback) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value ?? fallback);
  } catch {
    return fallback;
  }
}

// 读取后台配置的启用栏目 key，用于作品分类白名单校验。
// 栏目表为空或查询失败时回退到内置集合，避免空库把后台写入锁死。
export async function loadAllowedCategories(env) {
  if (!env || !env.DB) return [...CATEGORY_KEYS];
  try {
    const { results } = await env.DB.prepare(
      'SELECT key FROM categories WHERE enabled = 1 ORDER BY sort_order DESC, id ASC'
    ).all();
    const keys = results
      .map((row) => row.key)
      .filter((key) => typeof key === 'string' && key.length > 0);
    return keys.length > 0 ? keys : [...CATEGORY_KEYS];
  } catch {
    return [...CATEGORY_KEYS];
  }
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function isAllowedImageUrl(value, { allowEmpty = false } = {}) {
  if (allowEmpty && value === '') return true;
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (/^\/r2\/artworks\/[A-Za-z0-9._/-]+$/.test(value) && !value.includes('..')) {
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

function normalizeFlag(value, fallback, field, errors) {
  if (value === undefined) return fallback;
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  errors.push(`${field} 必须是 0 或 1`);
  return fallback;
}

export function validateArtworkPayload(body, options = {}) {
  const partial = options.partial === true;
  const errors = [];
  const data = {};

  // 分类白名单：优先用后台配置的启用栏目；未传则用内置兜底集合。
  const allowedCategories = options.allowedCategories
    ? new Set(Array.isArray(options.allowedCategories) ? options.allowedCategories : [])
    : CATEGORY_KEYS;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['请求体必须是 JSON 对象'], data };
  }

  const requiredString = (key, maxLength, label) => {
    if (!partial && !hasOwn(body, key)) {
      errors.push(`${label} 不能为空`);
      return;
    }
    if (!hasOwn(body, key)) return;

    if (typeof body[key] !== 'string') {
      errors.push(`${label} 必须是字符串`);
      return;
    }

    const value = body[key].trim();
    if (!value) errors.push(`${label} 不能为空`);
    else if (value.length > maxLength) errors.push(`${label} 不能超过 ${maxLength} 个字符`);
    else data[key] = value;
  };

  const optionalString = (key, maxLength, label) => {
    if (!hasOwn(body, key)) return;
    if (typeof body[key] !== 'string') {
      errors.push(`${label} 必须是字符串`);
      return;
    }
    const value = body[key].trim();
    if (value.length > maxLength) errors.push(`${label} 不能超过 ${maxLength} 个字符`);
    else data[key] = value;
  };

  requiredString('title', 200, 'title');

  optionalString('description', 10000, 'description');
  optionalString('medium', 200, 'medium');
  optionalString('dimensions', 200, 'dimensions');
  optionalString('price', 100, 'price');

  if (!partial && !hasOwn(body, 'description')) data.description = '';
  if (!partial && !hasOwn(body, 'medium')) data.medium = '';
  if (!partial && !hasOwn(body, 'dimensions')) data.dimensions = '';
  if (!partial && !hasOwn(body, 'price')) data.price = '';

  if (!partial || hasOwn(body, 'category')) {
    const category = body.category ?? 'other';
    if (typeof category !== 'string' || !allowedCategories.has(category)) {
      errors.push('category 不在允许的分类中');
    } else {
      data.category = category;
    }
  }

  if (!partial || hasOwn(body, 'year')) {
    if (!Number.isInteger(body.year) || body.year < 1900 || body.year > 2100) {
      errors.push('year 必须是 1900-2100 的整数');
    } else {
      data.year = body.year;
    }
  }

  if (!partial || hasOwn(body, 'images')) {
    if (!Array.isArray(body.images) || body.images.length === 0 || body.images.length > 20) {
      errors.push('images 必须是包含 1-20 张图片的数组');
    } else {
      const images = [];
      for (const image of body.images) {
        if (!isAllowedImageUrl(image)) {
          errors.push('images 中包含无效或不受支持的图片地址');
          break;
        }
        images.push(image.trim());
      }
      if (images.length === body.images.length) data.images = images;
    }
  }

  data.published = normalizeFlag(body.published, partial ? undefined : 0, 'published', errors);
  data.featured = normalizeFlag(body.featured, partial ? undefined : 0, 'featured', errors);
  data.sold = normalizeFlag(body.sold, partial ? undefined : 0, 'sold', errors);

  if (data.published === undefined) delete data.published;
  if (data.featured === undefined) delete data.featured;
  if (data.sold === undefined) delete data.sold;

  if (!partial || hasOwn(body, 'sort_order')) {
    const sortOrder = body.sort_order ?? 0;
    if (!Number.isInteger(sortOrder) || sortOrder < -1000000 || sortOrder > 1000000) {
      errors.push('sort_order 必须是 -1000000 到 1000000 的整数');
    } else {
      data.sort_order = sortOrder;
    }
  }

  return { errors, data };
}