// ============================================================
// GET /api/health
// 健康检查接口，用于验证部署是否成功
// ============================================================

export async function onRequest(context) {
  return Response.json({
    ok: true,
    service: 'art-website',
    timestamp: new Date().toISOString(),
    env: {
      hasDB: !!context.env.DB,
      hasBucket: !!context.env.BUCKET
    }
  });
}
