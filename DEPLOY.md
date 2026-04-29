# Deploy on Railway

StyleTwin è un monorepo con due servizi: **backend** (FastAPI) e **frontend** (Vite/React).
Su Railway li deployi come **due servizi separati** dello stesso progetto, entrambi
collegati alla stessa repo GitHub.

## 0. Prerequisiti

- Repo `Rizzo-AI-Academy/StyleTwin` collegata a Railway (Connect → GitHub).
- Plugin Postgres già esistente nel progetto (lo stesso `DATABASE_URL` che usi in dev).
- Account Clerk con app `poetic-stallion-64` (le chiavi sono già nel tuo `.env` locale).

---

## 1. Backend service

1. Su Railway → **+ New** → **GitHub Repo** → seleziona `Rizzo-AI-Academy/StyleTwin`.
2. **Settings → General → Root Directory**: `backend`
3. **Settings → Networking → Generate Domain** (es. `styletwin-backend.up.railway.app`).
4. **Variables** (Settings → Variables): copia dal tuo `backend/.env`:

   | Key | Value |
   |---|---|
   | `OPENAI_API_KEY` | `sk-proj-…` |
   | `OPENAI_IMAGE_MODEL` | `gpt-image-2-2026-04-21` |
   | `DATABASE_URL` | (referenza il plugin Postgres con `${{Postgres.DATABASE_URL}}` o usa la URL pubblica esistente) |
   | `CLERK_JWKS_URL` | `https://poetic-stallion-64.clerk.accounts.dev/.well-known/jwks.json` |
   | `CLERK_ISSUER` | `https://poetic-stallion-64.clerk.accounts.dev` |
   | `CLERK_SECRET_KEY` | `sk_test_…` |
   | `CORS_ORIGINS` | `https://styletwin-frontend.up.railway.app` (il dominio del FE — lo conosci dopo lo step 2) |
   | `MAX_UPLOAD_MB` | `10` |
   | `STORE_IMAGES_IN_DB` | `true` |
   | `AUTH_DISABLED` | `false` |

   Railway inietta automaticamente `PORT`. Non aggiungerla manualmente.

5. **Deploy**: build via Nixpacks (vede `requirements.txt`), start via `railway.json`
   (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
6. **Healthcheck**: `/api/health` (già configurato in [backend/railway.json](backend/railway.json)).

**Verifica**: apri `https://<backend-domain>/api/health` → `{"ok": true, ...}`.

---

## 2. Frontend service

1. Su Railway → **+ New** → **GitHub Repo** → stessa repo.
2. **Settings → General → Root Directory**: `frontend`
3. **Settings → Networking → Generate Domain** (es. `styletwin-frontend.up.railway.app`).
4. **Variables**:

   | Key | Value |
   |---|---|
   | `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_cG9ldGljLXN0YWxsaW9uLTY0…` |
   | `VITE_API_BASE_URL` | *(lasciare vuota — vedi nota sotto)* |
   | `BACKEND_URL` | `http://<backend-service>.railway.internal:8080` (URL **interna** del BE) |

   **Strategia di routing**: Caddy nel frontend fa reverse-proxy di `/api/*` verso
   il backend sulla rete privata di Railway. Il browser parla solo con il dominio HTTPS
   del frontend (stessa origine → niente CORS, niente mixed content), Caddy inoltra
   internamente. Vantaggi:
   - Nessun egress fee per le chiamate API
   - Backend non ha bisogno di un dominio pubblico
   - Niente headers CORS lato server (puoi anche restringere `CORS_ORIGINS` solo al
     dominio del frontend, ma in realtà tutte le chiamate arrivano same-origin)

   `BACKEND_URL` lo trovi su Railway → servizio backend → **Settings → Networking →
   Private Networking**. Formato: `http://<service-name>.railway.internal:<PORT>`.
   La porta è quella che il BE espone (di default Railway usa 8080 internamente quando
   il container ascolta su `$PORT`).

   > ⚠️ Le `VITE_*` sono **inlined al build**. Se le cambi, devi triggerare un redeploy
   > (Settings → Redeploy). `BACKEND_URL` invece è letta runtime dal Caddy, basta
   > restartare.

5. **Deploy**: build via Nixpacks (`npm ci && npm run build`), start via `npm start`
   che lancia `serve -s dist -l tcp://0.0.0.0:$PORT` con SPA fallback.

**Verifica**: apri `https://<frontend-domain>` → vedi la landing.

---

## 3. Allineare CORS (post-deploy)

Una volta che hai entrambi i domini:

1. Backend → Variables → aggiorna `CORS_ORIGINS`:
   `https://styletwin-frontend.up.railway.app`
   (più virgole se ne hai più di uno — niente trailing slash).
2. Riavvia il backend (Deployments → Redeploy).

---

## 4. Aggiornare Clerk

In Clerk Dashboard → tua app → **Domains**:
- Aggiungi `https://styletwin-frontend.up.railway.app` come **Production frontend**.

Se usi le chiavi `pk_test_` / `sk_test_` resta in modalità development di Clerk; per
produzione vera passa alle chiavi `pk_live_` / `sk_live_` e aggiorna sia
`VITE_CLERK_PUBLISHABLE_KEY` (FE) sia `CLERK_SECRET_KEY` (BE).

---

## 5. File rilevanti per il deploy

- [backend/railway.json](backend/railway.json) — start command + healthcheck `/api/health`
- [backend/Procfile](backend/Procfile) — fallback per builder Procfile-based
- [backend/run.py](backend/run.py) — legge `PORT` da env (utile anche in locale)
- [frontend/railway.json](frontend/railway.json) — build (`npm ci && npm run build`) + start (`npm start`)
- [frontend/package.json](frontend/package.json) — script `start` con `serve -s dist`

---

## 6. Troubleshooting

| Sintomo | Causa | Fix |
|---|---|---|
| FE 502 / "Application failed to respond" | `serve` non parte sulla `$PORT` di Railway | Controlla che `npm start` sia il comando di start; lo script gestisce `${PORT:-3000}` |
| FE chiama `localhost:8000` in prod | `VITE_API_BASE_URL` non era settata al build | Settala su Railway, poi **Redeploy** (non basta restart) |
| BE risponde `CORS error` dal browser | `CORS_ORIGINS` non include il dominio FE | Aggiorna la var e Redeploy |
| Login Clerk non funziona | Dominio non whitelisted in Clerk | Clerk Dashboard → Domains → Add |
| `psycopg.OperationalError` | DB irraggiungibile | Usa `${{Postgres.DATABASE_URL}}` invece dell'URL pubblica |
| Build BE fallisce su `psycopg` | Libreria di sistema mancante | Nixpacks dovrebbe installarla automaticamente; se no, aggiungi un `nixpacks.toml` con `[phases.setup] aptPkgs = ["libpq-dev"]` |
