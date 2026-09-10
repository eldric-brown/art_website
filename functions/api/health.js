import { json, methodNotAllowed } from '../_lib/http.js';

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  const checks = {
    databaseBinding: Boolean(env.DB),
    storageBinding: Boolean(env.BUCKET)
  };

  if (!checks.databaseBinding || !checks.storageBinding) {
    return json({
      ok: false,
      service: 'art-website',
      error: 'binding_not_configured',
      checks
    }, 503);
  }

  try {
    await env.DB.prepare('SELECT 1 AS ok').first();
  } catch (error) {
    console.error('health database check failed:', error);
    return json({
      ok: false,
      service: 'art-website',
      error: 'database_unavailable',
      checks
    }, 503);
  }

  return json({
    ok: true,
    service: 'art-website',
    timestamp: new Date().toISOString(),
    checks
  });
}