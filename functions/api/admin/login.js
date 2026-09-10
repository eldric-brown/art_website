import { createSessionCookie, secureStringEqual } from '../../_lib/auth.js';
import { json, methodNotAllowed } from '../../_lib/http.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  if (typeof env.ADMIN_PASSWORD !== 'string' || env.ADMIN_PASSWORD.length < 8) {
    console.error('ADMIN_PASSWORD is missing or too short');
    return json({
      ok: false,
      error: 'server_misconfigured',
      message: '管理员密码尚未正确配置'
    }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const password = body && typeof body.password === 'string' ? body.password : '';
  if (!password || password.length > 512) {
    return json({
      ok: false,
      error: 'invalid_credentials',
      message: '密码错误'
    }, 401);
  }

  if (!(await secureStringEqual(password, env.ADMIN_PASSWORD))) {
    return json({
      ok: false,
      error: 'invalid_credentials',
      message: '密码错误'
    }, 401);
  }

  const cookie = await createSessionCookie(request, env);
  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}