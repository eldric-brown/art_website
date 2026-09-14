import { getSessionUserId } from '../../_lib/auth.js';
import { json, methodNotAllowed } from '../../_lib/http.js';

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) return methodNotAllowed(['GET', 'HEAD']);
  if (!env.DB) return json({ ok: false, error: 'database_unavailable' }, 500);

  const userId = await getSessionUserId(request, env);
  if (!userId) return json({ ok: false, error: 'unauthorized' }, 401);

  try {
    const user = await env.DB.prepare(
      `SELECT id, username, password_hash, created_at, updated_at
       FROM users
       WHERE id = ?`
    ).bind(userId).first();

    if (!user) return json({ ok: false, error: 'unauthorized' }, 401);
    return json({ ok: true, data: { user: { id: user.id, username: user.username, created_at: user.created_at, updated_at: user.updated_at, must_change_password: !user.password_hash } } });
  } catch (error) {
    console.error('load account failed:', error);
    return json({ ok: false, error: 'internal_error', message: '账号信息加载失败' }, 500);
  }
}
