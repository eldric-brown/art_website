import {
  createPasswordRecord,
  createSessionCookie,
  getSessionUserId,
  verifyPassword
} from '../../_lib/auth.js';
import { json, methodNotAllowed } from '../../_lib/http.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'PUT') return methodNotAllowed(['PUT']);
  if (!env.DB) return json({ ok: false, error: 'database_unavailable' }, 500);

  const userId = await getSessionUserId(request, env);
  if (!userId) return json({ ok: false, error: 'unauthorized' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const currentPassword = body && typeof body.current_password === 'string' ? body.current_password : '';
  const newPassword = body && typeof body.new_password === 'string' ? body.new_password : '';
  const errors = [];

  if (currentPassword.length > 512) errors.push('当前密码不能超过 512 位');
  if (!newPassword || newPassword.length < 8) errors.push('新密码至少需要 8 位');
  if (newPassword.length > 128) errors.push('新密码不能超过 128 位');
  if (currentPassword && newPassword && currentPassword === newPassword) errors.push('新密码不能与当前密码相同');

  if (errors.length) {
    return json({ ok: false, error: 'validation_failed', details: errors }, 422);
  }

  try {
    const user = await env.DB.prepare(
      `SELECT id, username, password_hash, password_salt, password_iterations, password_algo
       FROM users
       WHERE id = ?`
    ).bind(userId).first();

    if (!user) return json({ ok: false, error: 'unauthorized' }, 401);
    // 密码哈希为空（首次设置）：跳过当前密码校验
    if (user.password_hash !== '') {
      if (!currentPassword) {
        return json({ ok: false, error: 'invalid_password', message: '当前密码不能为空' }, 422);
      }
      if (!(await verifyPassword(currentPassword, user))) {
        return json({ ok: false, error: 'invalid_password', message: '当前密码不正确' }, 401);
      }
    }

    const record = await createPasswordRecord(newPassword);
    const result = await env.DB.prepare(
      `UPDATE users
       SET password_hash = ?, password_salt = ?, password_iterations = ?, password_algo = ?
       WHERE id = ?`
    ).bind(
      record.hash,
      record.salt,
      record.iterations,
      record.algorithm,
      userId
    ).run();

    if (result.meta.changes === 0) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    const cookie = await createSessionCookie(request, env, userId);
    return json({
      ok: true,
      data: { username: user.username },
      message: '密码修改成功'
    }, 200, { 'Set-Cookie': cookie });
  } catch (error) {
    console.error('change password failed:', error);
    return json({ ok: false, error: 'internal_error', message: '密码修改失败：' + (error && error.message ? error.message : String(error)) }, 500);
  }
}
