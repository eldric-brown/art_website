import { clearSessionCookie } from '../../_lib/auth.js';
import { json, methodNotAllowed } from '../../_lib/http.js';

export async function onRequest({ request }) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  return json({ ok: true }, 200, {
    'Set-Cookie': clearSessionCookie(request)
  });
}