// ============================================================
// _lib/research.js - 「研究方向」板块/条目的校验与序列化
// ============================================================
// 供 functions/api/research.js 与 functions/api/admin/research/** 共用。
// ============================================================

import {
  sanitizeRichHtml,
  MAX_BODY_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_SORT_ORDER
} from './html.js';

// 板块标识：小写英文开头，后跟小写英文/数字/下划线/连字符（如 question、experiments）
export const SLUG_RE = /^[a-z][a-z0-9_-]{0,63}$/;

export function validateSort(raw, label) {
  const value = Number(raw);
  if (!Number.isFinite(value) || Math.abs(value) > MAX_SORT_ORDER) {
    return label + ' must be a number between -' + MAX_SORT_ORDER + ' and ' + MAX_SORT_ORDER;
  }
  return null;
}

// enabled 接受 0/1/'0'/'1'/true/false，缺省按 1 处理
export function toFlag(raw) {
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return 0;
  return 1;
}

// 校验板块字段。返回 { errors, data }，data 只含本次需要写入的字段。
export function validateSectionPayload(body, opts) {
  opts = opts || {};
  const errors = [];
  const data = {};
  const allowed = ['slug', 'title', 'subtitle', 'sort_order', 'enabled'];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['request body must be a JSON object'], data };
  }

  const keys = Object.keys(body).filter(function (key) { return key in body; });
  for (const key of keys) {
    if (!allowed.includes(key)) errors.push('unknown field: ' + key);
  }
  if (errors.length) return { errors, data };

  // 新建时必须给 slug；更新时可省略（保持原值）
  if (!opts.partial || body.slug !== undefined) {
    const slug = String(body.slug == null ? '' : body.slug).trim();
    if (!SLUG_RE.test(slug)) {
      errors.push('slug must match ' + SLUG_RE.source + ' (e.g. question, experiments)');
    } else {
      data.slug = slug;
    }
  }

  if (body.title !== undefined || !opts.partial) {
    const title = String(body.title == null ? '' : body.title).trim();
    if (!title) errors.push('title is required');
    else if (title.length > MAX_TITLE_LENGTH) errors.push('title exceeds ' + MAX_TITLE_LENGTH + ' characters');
    else data.title = title;
  }

  if (body.subtitle !== undefined) {
    const subtitle = String(body.subtitle == null ? '' : body.subtitle).trim();
    if (subtitle.length > MAX_TEXT_LENGTH) errors.push('subtitle exceeds ' + MAX_TEXT_LENGTH + ' characters');
    else data.subtitle = subtitle;
  } else if (!opts.partial) {
    data.subtitle = '';
  }

  if (body.sort_order !== undefined) {
    const err = validateSort(body.sort_order, 'sort_order');
    if (err) errors.push(err);
    else data.sort_order = Math.round(Number(body.sort_order));
  } else if (!opts.partial) {
    data.sort_order = 0;
  }

  if (body.enabled !== undefined) data.enabled = toFlag(body.enabled);

  return { errors, data };
}

// 校验条目字段。body 在这里就被净化，落库的永远是白名单 HTML。
export function validateItemPayload(body, opts) {
  opts = opts || {};
  const errors = [];
  const data = {};
  const allowed = ['section_id', 'title', 'body', 'sort_order', 'enabled'];

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['request body must be a JSON object'], data };
  }

  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) errors.push('unknown field: ' + key);
  }
  if (errors.length) return { errors, data };

  if (body.section_id !== undefined || !opts.partial) {
    const sectionId = Number(body.section_id);
    if (!Number.isInteger(sectionId) || sectionId < 1) {
      errors.push('section_id must be a positive integer');
    } else {
      data.section_id = sectionId;
    }
  }

  if (body.title !== undefined) {
    const title = String(body.title == null ? '' : body.title).trim();
    if (title.length > MAX_TITLE_LENGTH) errors.push('title exceeds ' + MAX_TITLE_LENGTH + ' characters');
    else data.title = title;
  } else if (!opts.partial) {
    data.title = '';
  }

  if (body.body !== undefined) {
    data.body = sanitizeRichHtml(body.body, MAX_BODY_LENGTH);
  } else if (!opts.partial) {
    data.body = '';
  }

  if (body.sort_order !== undefined) {
    const err = validateSort(body.sort_order, 'sort_order');
    if (err) errors.push(err);
    else data.sort_order = Math.round(Number(body.sort_order));
  } else if (!opts.partial) {
    data.sort_order = 0;
  }

  if (body.enabled !== undefined) data.enabled = toFlag(body.enabled);

  return { errors, data };
}

export function serializeItem(row) {
  return {
    id: Number(row.id),
    section_id: Number(row.section_id),
    title: String(row.title == null ? '' : row.title),
    body: String(row.body == null ? '' : row.body),
    sort_order: Number(row.sort_order) || 0,
    enabled: Number(row.enabled) === 0 ? 0 : 1,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function serializeSection(row, items) {
  return {
    id: Number(row.id),
    slug: String(row.slug == null ? '' : row.slug),
    title: String(row.title == null ? '' : row.title),
    subtitle: String(row.subtitle == null ? '' : row.subtitle),
    sort_order: Number(row.sort_order) || 0,
    enabled: Number(row.enabled) === 0 ? 0 : 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
    items: items || []
  };
}

// 取出「板块 -> 条目」的映射，保持接口顺序语义一致
export function groupItemsBySection(rows) {
  const map = {};
  for (const row of rows || []) {
    const key = Number(row.section_id);
    if (!map[key]) map[key] = [];
    map[key].push(serializeItem(row));
  }
  return map;
}