Frontend for TerraGrid (HackMIT 2025).

### Dev

- pnpm dev — Next.js with Turbopack. `turbopack.root` is set in `next.config.ts` to silence multi-lockfile warnings.
- pnpm build — production build.

### Env

Create a `.env.local`:

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Routes

- `/` — Landing page describing system approach, Cerebras escalation, and iron‑air context.
- `/metrics` — Live dashboard polling `/api/metrics` every ~2s; the API proxies `${NEXT_PUBLIC_BACKEND_URL}/metrics`.

### Theme

Dark/light via `next-themes`. Toggle in the header.

### shadcn components in use

`button`, `card`, `badge`, `table`, `separator`, `chart`.
