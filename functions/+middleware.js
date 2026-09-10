// ============================================================
// 全局认证中间件
// 作用：仅保护 /admin/* 页面和 /api/admin/* API
// 非 admin 路径直接放行，不影响性能
// 参考：https://developers.cloudflare.com/pages/functions/middleware/
// ============================================================

const PROTECTED_PREFIXES = ['/admin', '/api/admin'];

/**
 * 判断路径是否需要认证
 */
function isProtected(path) {
  return PROTECTED_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
}

/**
 * 判断是否拥有有效的会话 Cookie
 */
function hasSession(request) {
  const cookies = request.headers.get('Cookie') || '';
  // 简单 session 标记：实际生产建议用 HttpOnly + Secure + 服务端验证
  return cookies.includes('art_session=1');
}

/**
 * 生成认证失败响应
 */
function unauthorizedResponse(request) {
  const path = new URL(request.url).pathname;

  // API 请求返回 JSON
  if (path.startsWith('/api/')) {
    return Response.json({
      ok: false,
      error: 'unauthorized',
      message: '请先登录后台'
    }, { status: 401 });
  }

  // 页面请求重定向到登录页
  const url = new URL(request.url);
  url.pathname = '/admin/login';
  url.searchParams.set('next', path);
  return Response.redirect(url.toString(), 302);
}

export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);

  // 非受保护路径直接放行
  if (!isProtected(url.pathname)) {
    return context.next();
  }

  // 允许访问登录页
  if (url.pathname === '/admin/login' || url.pathname === '/api/admin/login') {
    return context.next();
  }

  // 检查 session
  if (!hasSession(request)) {
    return unauthorizedResponse(request);
  }

  return context.next();
}
