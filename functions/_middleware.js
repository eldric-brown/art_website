import { hasValidSession } from './_lib/auth.js';

const PROTECTED_PREFIXES = ['/admin', '/api/admin'];
const LOGIN_PATHS = new Set(['/admin/login', '/admin/login.html', '/api/admin/login']);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isProtected(path) {
  return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function withSecurityHeaders(response) {
  const secured = new Response(response.body, response);
  secured.headers.set('X-Content-Type-Options', 'nosniff');
  secured.headers.set('X-Frame-Options', 'DENY');
  secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  secured.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return secured;
}

function unauthorizedResponse(request) {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    return withSecurityHeaders(Response.json({
      ok: false,
      error: 'unauthorized',
      message: '请先登录后台'
    }, { status: 401 }));
  }

  const loginUrl = new URL(request.url);
  loginUrl.pathname = '/admin/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('next', url.pathname);
  return withSecurityHeaders(Response.redirect(loginUrl.toString(), 302));
}

function isSameOriginRequest(request) {
  const origin = request.headers.get('Origin');
  if (!origin) {
    return request.headers.get('Sec-Fetch-Site') !== 'cross-site';
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (!isProtected(url.pathname)) {
    return withSecurityHeaders(await context.next());
  }

  if (LOGIN_PATHS.has(url.pathname)) {
    return withSecurityHeaders(await context.next());
  }

  if (!(await hasValidSession(request, context.env))) {
    return unauthorizedResponse(request);
  }

  if (MUTATING_METHODS.has(request.method) && !isSameOriginRequest(request)) {
    return withSecurityHeaders(Response.json({
      ok: false,
      error: 'cross_site_request_blocked',
      message: '请求来源校验失败'
    }, { status: 403 }));
  }

  return withSecurityHeaders(await context.next());
}