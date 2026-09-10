// ============================================================
// POST /api/admin/login
// 使用简单密码进行登录，成功后种 session Cookie
//
// 请求体：{ "password": "xxx" }
// 响应：  { "ok": true } + Set-Cookie: art_session=1
//
// ⚠️  生产建议：这里只是最简实现。若追求更强安全，请改为：
//     1. 使用 bcrypt 对密码做哈希
//     2. 使用短期 token 存 KV，Cookie 里只存 token 引用
// ============================================================

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await request.json();
    const inputPassword = body.password;
    const expected = env.ADMIN_PASSWORD;

    if (!expected || !inputPassword) {
      return json({ ok: false, error: 'missing_fields' }, 400);
    }

    // 简单等值比较（生产建议用 timingSafeEqual 或 bcrypt）
    if (inputPassword !== expected) {
      return json(
        { ok: false, error: 'invalid_credentials', message: '密码错误' },
        401
      );
    }

    // 生成一个简易 session token（时间戳 + 随机数）
    const token = generateToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 小时

    return new Response(JSON.stringify({ ok: true, token }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `art_session=1; token=${token}; Path=/; Max-Age=86400; SameSite=Lax; ${isSecure() ? 'Secure;' : ''}`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return json({ ok: false, error: 'bad_request', message: e.message }, 400);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function generateToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Pages Functions 环境总是 HTTPS，可以打 Secure 标记
function isSecure() {
  return true;
}
