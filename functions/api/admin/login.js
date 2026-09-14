import {
  createPasswordRecord,
  createSessionCookie,
  secureStringEqual,
  verifyPassword
} from '../../_lib/auth.js';
import { json, methodNotAllowed } from '../../_lib/http.js';

const BOOTSTRAP_USERNAME = 'admin';

function invalidCredentials() {
  return json({
    ok: false,
    error: 'invalid_credentials',
    message: '登录名或密码错误'
  }, 401);
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  if (!env.DB) {
    return json({ ok: false, error: 'database_unavailable', message: '登录服务暂不可用' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const username = body && typeof body.username === 'string' ? body.username.trim() : '';
  const password = body && typeof body.password === 'string' ? body.password : '';
  if (!username || username.length > 50 || !password || password.length > 512) {
    return invalidCredentials();
  }

  try {
    let user = await env.DB.prepare(
      `SELECT id, username, password_hash, password_salt, password_iterations, password_algo
       FROM users
       WHERE username = ? COLLATE NOCASE`
    ).bind(username).first();

    let loginUsername = user ? user.username : '';

    if (!user) {
      const countRow = await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first();
      const usersCount = Number((countRow && countRow.count) || 0);
      const canBootstrap = usersCount === 0 &&
        username.toLowerCase() === BOOTSTRAP_USERNAME &&
        typeof env.ADMIN_PASSWORD === 'string' &&
        env.ADMIN_PASSWORD.length >= 8;

      if (!canBootstrap || !(await secureStringEqual(password, env.ADMIN_PASSWORD))) {
        return invalidCredentials();
      }

      const record = await createPasswordRecord(password);
      const result = await env.DB.prepare(
        `INSERT INTO users
           (username, password_hash, password_salt, password_iterations, password_algo)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        BOOTSTRAP_USERNAME,
        record.hash,
        record.salt,
        record.iterations,
        record.algorithm
      ).run();

      user = { id: result.meta.last_row_id, username: BOOTSTRAP_USERNAME };
      loginUsername = BOOTSTRAP_USERNAME;
    } else if (!(await verifyPassword(password, user))) {
      return invalidCredentials();
    }

    const cookie = await createSessionCookie(request, env, Number(user.id));
    return json({
      ok: true,
      data: { username: loginUsername }
    }, 200, { 'Set-Cookie': cookie });
  } catch (error) {
    console.error('login failed:', error);
    return json({
      ok: false,
      error: 'login_unavailable',
      message: '登录服务暂不可用，请检查数据库迁移'
    }, 500);
  }
}
