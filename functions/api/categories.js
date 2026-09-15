import { json, methodNotAllowed } from '../_lib/http.js';

// 栏目表为空（002 迁移未跑）时的兜底展示，与内置 CATEGORY_KEYS 一一对应。
const FALLBACK_CATEGORIES = [
  { key: 'oil', name: 'Oil Painting', image: '', sort_order: 70 },
  { key: 'watercolor', name: 'Watercolor', image: '', sort_order: 60 },
  { key: 'sketch', name: 'Sketch', image: '', sort_order: 50 },
  { key: 'ink', name: 'Chinese Painting', image: '', sort_order: 40 },
  { key: 'digital', name: 'Digital', image: '', sort_order: 30 },
  { key: 'photograph', name: 'Photograph', image: '', sort_order: 20 },
  { key: 'other', name: 'Other', image: '', sort_order: 10 }
];

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT key, name, image, sort_order
       FROM categories
       WHERE enabled = 1
       ORDER BY sort_order DESC, id ASC`
    ).all();

    return json({
      ok: true,
      data: { categories: results.length > 0 ? results : FALLBACK_CATEGORIES }
    });
  } catch (error) {
    console.error('list categories failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '栏目加载失败'
    }, 500);
  }
}
