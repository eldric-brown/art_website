import { json, methodNotAllowed } from '../_lib/http.js';

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  // 图片已改为外链方案，R2 绑定变为可选：未绑定时 upload 接口返回 bucket_not_configured，
  // 不影响站点与后台其余功能的正常运作。
  const checks = {
    databaseBinding: Boolean(env.DB),
    storageBinding: Boolean(env.BUCKET)
  };

  if (!checks.databaseBinding) {
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