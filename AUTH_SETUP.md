# Auth Setup — Supabase + Vercel

This file is the canonical checklist for everything that has to be configured **outside** the repo in order for the auth flow to work. The code in this repo assumes these steps are done.

## 1. Supabase project dashboard

### Enable auth providers

Authentication → Providers:

1. **Email** — Enabled by default. Under settings:
   - Enable "Confirm email" (sends confirmation link on signup).
   - Set "Site URL" to `http://localhost:3000` in development, `https://<your-vercel-domain>` in production.
2. **Google** — Enable. Requires a Google Cloud OAuth client:
   - Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application.
   - Authorized redirect URIs must include:
     - `https://<project-ref>.supabase.co/auth/v1/callback`
   - Copy client ID + secret into the Supabase Google provider form.
3. **Apple** — Enable. Requires an Apple Developer Services ID:
   - developer.apple.com → Certificates, Identifiers & Profiles → Services IDs → create one for this app.
   - Domain: `<project-ref>.supabase.co`. Return URL: `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Generate a private key (Sign in with Apple), download the `.p8`, use it and the key ID + team ID to build the Apple OAuth secret JWT. Paste client ID + secret into the Supabase Apple provider form.

### Redirect URLs

Authentication → URL Configuration → Redirect URLs. Add **both**:

- `http://localhost:3000/auth/callback`
- `https://<your-vercel-domain>/auth/callback`

### SQL — profiles table and trigger

This repo ships the SQL in `supabase/migrations/20260512000000_profiles.sql`. Apply it one of two ways:

- **Locally (Supabase CLI):** `npm run supabase:db:push` (or `supabase db push`).
- **Production:** open the Supabase dashboard → SQL Editor, paste the contents of the migration file, run. Then re-run `supabase db push` after linking the project.

The migration creates:
- `public.profiles` (id UUID FK → `auth.users`, email, full_name, avatar_url, onboarding_complete, timestamps)
- RLS enabled with `select` / `update` / `insert` policies scoped to `auth.uid() = id`
- `handle_new_user()` trigger that inserts a profile row on every `auth.users` insert
- `handle_profile_updated()` trigger that keeps `updated_at` fresh

### Local `supabase/config.toml`

`[auth]` has been flipped to `enabled = true` with local redirect URLs. Google and Apple providers are scaffolded as `enabled = false` — set to `true` and provide env vars (`SUPABASE_AUTH_GOOGLE_CLIENT_ID`, etc.) in your local `.env` if you want to test OAuth locally against the Supabase stack.

## 2. Vercel environment variables

Project Settings → Environment Variables. Required for **Production** and **Preview**:

- `NEXT_PUBLIC_SUPABASE_URL` — `https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key from Supabase → Project Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (server-only; never expose to browser)
- `NEXT_PUBLIC_APP_URL` — `https://<your-vercel-domain>`
- `DATABASE_URL` — Supabase Postgres pooled connection string (for Prisma)

Keep `OPENAI_API_KEY`, `OPENAI_OCR_MODEL`, `OPENAI_INSIGHTS_MODEL`, `SUPABASE_OCR_BUCKET` from the previous phase.

After adding env vars, redeploy so they take effect.

## 3. Prisma / existing data model

The existing schema already scopes every user-owned table by `localUserId` (default `"local-user"`). The auth phase **reuses that column** rather than adding a parallel `supabaseUserId` column — the spec's intent (scope all data to a real user) is met by storing the authenticated user's UUID in `localUserId` going forward.

No Prisma migration is needed in this phase. Later phases that actually *read* the session on server actions / API routes will pass `session.user.id` into `localUserId`. The seed continues to use the literal string `"local-user"` for local dev; in production every row is owned by a real Supabase user UUID.

If we ever decide to rename the column, that is a follow-up migration — out of scope here.

## 4. Test credential

A canonical test account is defined in `scripts/create-test-user.ts`:

- **Email:** `test@stashy.local`
- **Password:** `Stashy-Test-2026!`

Create it locally with:

```bash
npx tsx scripts/create-test-user.ts
```

The script uses the service role key to bypass email confirmation. It's idempotent — running it twice does nothing. Never run it against production.

## 5. Smoke-test checklist

Before calling the auth phase done, verify in production:

- [ ] Sign up with Google → `/onboarding` → `/app/budget`
- [ ] Sign up with Apple → `/onboarding` → `/app/budget`
- [ ] Sign up with email → confirmation email arrives → link → `/onboarding`
- [ ] Sign in with existing account → `/app/budget` (no onboarding)
- [ ] Unauthenticated `/app/budget` → redirect to `/signin`
- [ ] After sign-out, browser back button does not show authenticated app
- [ ] TypeScript clean, no console errors
