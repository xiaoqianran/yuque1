import { useEffect, useState } from 'react';

type HealthPayload = {
  success: boolean;
  data: { status: string } | null;
};

export function HomePage() {
  const [health, setHealth] = useState<string>('checking…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/health', { credentials: 'include' });
        const body = (await res.json()) as HealthPayload;
        if (!cancelled) {
          setHealth(body.success ? `API ${body.data?.status ?? 'ok'}` : 'API error');
        }
      } catch {
        if (!cancelled) setHealth('API offline（请启动 apps/api）');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card">
      <h1>可自托管知识库</h1>
      <p className="muted">工程基线 M0：Monorepo + Nest API + React Web + Prisma + Compose</p>
      <p>
        健康检查：<strong>{health}</strong>
      </p>
      <ul>
        <li>
          契约：<code>docs/api/openapi.yaml</code>
        </li>
        <li>
          模型：<code>docs/design/01-领域模型与数据库.md</code>
        </li>
        <li>
          Compose：<code>deploy/compose/docker-compose.yml</code>
        </li>
      </ul>
    </section>
  );
}
