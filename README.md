# Livra

Marketplace conversacional (WhatsApp), pagos y última milla.

Arquitectura: **monolito modular orientado a eventos** (MVP), desplegable en EasyPanel.

## Stack

| Capa | Tecnología |
|------|------------|
| Web / PWA | Next.js 15 + TypeScript |
| API | NestJS + TypeScript |
| Datos | PostgreSQL + Prisma |
| Jobs / cache | Redis + BullMQ |
| Deploy | EasyPanel (Docker) |

## Estructura

```
apps/api   → API + workers
apps/web   → Portal, panel restaurante, PWA repartidor, backoffice
packages/shared → Tipos y contratos de eventos
```

## Desarrollo local

```bash
pnpm install
cp .env.example .env
# Levantar Postgres + Redis (docker compose o servicios locales)
pnpm db:generate
pnpm --filter @livra/api prisma:migrate
pnpm dev:api   # :4000
pnpm dev:web   # :3000
```

## EasyPanel

Proyecto `livra`:

- `postgres` / `redis` — datos
- `api` — `apps/api/Dockerfile` → puerto 4000
- `web` — `apps/web/Dockerfile` → puerto 3000

## Fases MVP

0. Fundaciones · 1. Pedido asistido · 2. Pago · 3. Entrega · 4. Operación · 5. Optimización
