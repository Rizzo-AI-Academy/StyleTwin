# StyleTwin — Technical Documentation

Documentazione tecnica del codice di **StyleTwin**, una webapp che genera report di personal
styling premium a partire da un ritratto, con autenticazione **Clerk** e persistenza su
**PostgreSQL**, usando **`gpt-image-2-2026-04-21`** di OpenAI.

---

## 1. Indice

1. [Panoramica](#2-panoramica)
2. [Architettura](#3-architettura)
3. [Pipeline di generazione](#4-pipeline-di-generazione)
4. [Struttura del repository](#5-struttura-del-repository)
5. [Backend — moduli](#6-backend--moduli)
6. [Database & schema](#7-database--schema)
7. [Autenticazione Clerk](#8-autenticazione-clerk)
8. [API HTTP](#9-api-http)
9. [Prompt library](#10-prompt-library)
10. [Frontend — moduli](#11-frontend--moduli)
11. [Configurazione](#12-configurazione)
12. [Avvio locale](#13-avvio-locale)
13. [Estensioni future](#14-estensioni-future)

---

## 2. Panoramica

StyleTwin è composto da:

- **Backend FastAPI** che espone:
  - `POST /api/report` (autenticato): riceve un ritratto, costruisce il prompt, chiama
    `gpt-image-2` e persiste una `Generation` per l'utente.
  - `GET/PATCH /api/me`: profilo dell'utente loggato (sincronizzato con Clerk + campo `age`
    custom).
  - `GET /api/me/generations`, `GET /api/me/generations/{id}`: storico delle generazioni.
- **Frontend Vite + React + TypeScript** con sign-in/sign-up tramite **@clerk/clerk-react**,
  dropzone per il caricamento del ritratto, selettore del tipo di report, profilo editabile,
  e cronologia generazioni.
- **PostgreSQL** (es. Railway) con tabelle `users` e `generations`, gestite via
  **SQLAlchemy 2.x** (`Base.metadata.create_all` allo startup).
- **Clerk** per autenticazione: il frontend ottiene una sessione JWT, il backend la verifica
  via JWKS (PyJWT) e fa upsert dell'utente nella tabella `users` recuperando da Clerk
  Backend API i campi profilo (first/last name, email, image_url).

Il modello immagine riceve la foto come **identity reference**: gli viene chiesto di
mantenere identità, lineamenti, forma del viso, tono della pelle e proporzioni invariate,
modificando solo hairstyle, abbigliamento, colori, accessori, sfondo e layout grafico.

---

## 3. Architettura

```
┌───────────────────────────┐    /api/report (Bearer JWT)    ┌──────────────────────────┐
│  Frontend (Vite/React)    │  ─────── multipart ─────────►  │  Backend (FastAPI)       │
│  - Clerk SignIn/SignUp    │                                │  - Clerk JWT verify      │
│  - dropzone + selettori   │                                │  - upsert User           │
│  - profilo + cronologia   │  ◄── { id, image_b64 } ──────  │  - log Generation        │
│  - Bearer = Clerk session │                                │  - call OpenAI           │
└───────────────────────────┘                                └────────┬─────────┬───────┘
                                                                      │         │
                                                                      ▼         ▼
                                                       ┌──────────────────┐  ┌───────────────────┐
                                                       │ Postgres (Railway)│  │ OpenAI gpt-image-2│
                                                       │ users / generations│ │ identity-preserving│
                                                       │                    │ │ image edit         │
                                                       └────────────────────┘ └───────────────────┘
```

---

## 4. Pipeline di generazione

1. L'utente fa sign-in via Clerk (frontend `<SignIn />`).
2. Il frontend chiama `POST /api/report` includendo il JWT Clerk in `Authorization: Bearer …`.
3. Il backend verifica il token via JWKS, fa upsert dell'utente in `users` (recupera nome/email
   da Clerk Backend API se `CLERK_SECRET_KEY` è configurato).
4. Inserisce un record `Generation` con `status=pending` e i metadata (report_type, size,
   quality, prompt, mime, byte size).
5. Chiama `client.images.edit(model="gpt-image-2-2026-04-21", image=portrait, prompt=…)`.
6. Aggiorna la `Generation` con `status=success` e — se `STORE_IMAGES_IN_DB=true` — il
   `image_b64`.
7. Risponde al frontend con `{ id, report_type, image_b64, mime_type }`.

In caso di errore, la riga viene marcata `status=failed` con `error_message`.

---

## 5. Struttura del repository

```
vibecoding_app_completa/
├── README.md
├── DOCS.md                       Questo documento
├── backend/
│   ├── .env.example              Template variabili d'ambiente
│   ├── .env                      (locale, non committare)
│   ├── .gitignore
│   ├── requirements.txt          Dipendenze Python
│   ├── run.py                    Launcher uvicorn
│   └── app/
│       ├── __init__.py
│       ├── config.py             Settings da .env (Pydantic)
│       ├── db.py                 Engine + sessionmaker SQLAlchemy
│       ├── models.py             ORM: User, Generation
│       ├── clerk_auth.py         Verifica JWT Clerk + upsert User
│       ├── main.py               FastAPI app, middleware, routes
│       ├── prompts.py            Libreria di prompt per gpt-image-2
│       ├── schemas.py            Tipi (ReportType)
│       └── services.py           Wrapper OpenAI image edit
└── frontend/
    ├── .env.example              VITE_CLERK_PUBLISHABLE_KEY
    ├── .gitignore
    ├── index.html                Entry HTML Vite
    ├── package.json              Dipendenze Node (incl. @clerk/clerk-react)
    ├── tsconfig.json
    ├── vite.config.ts            Vite + proxy /api → :8000
    └── src/
        ├── api.ts                Client REST tipizzato (con Bearer Clerk)
        ├── App.tsx               UI: AuthGate, Studio, Profile, History
        ├── main.tsx              ClerkProvider + bootstrap React
        └── styles.css            Tema dark/luxury
```

---

## 6. Backend — moduli

### 6.1 [config.py](backend/app/config.py)

Definisce `Settings` (Pydantic) caricata da `.env`. Espone:

| Campo | Tipo | Default | Descrizione |
|---|---|---|---|
| `openai_api_key`       | `str`  | `""`                       | API key OpenAI |
| `openai_image_model`   | `str`  | `gpt-image-2-2026-04-21`   | Modello immagine |
| `cors_origins`         | `str`  | `http://localhost:5173,…`  | Origini CORS comma-separated |
| `max_upload_mb`        | `int`  | `10`                       | Limite upload in MB |
| `database_url`         | `str`  | `""`                       | Connection string Postgres |
| `clerk_jwks_url`       | `str`  | `""`                       | URL JWKS Clerk |
| `clerk_issuer`         | `str`  | `""`                       | Issuer atteso del JWT |
| `clerk_secret_key`     | `str`  | `""`                       | Backend API key per Clerk |
| `auth_disabled`        | `bool` | `false`                    | DEV: bypassa auth |
| `store_images_in_db`   | `bool` | `true`                     | Salva PNG in `generations.image_b64` |

`get_settings()` è memoizzata con `@lru_cache`.

### 6.2 [db.py](backend/app/db.py)

- `Base`: `DeclarativeBase` per i modelli ORM.
- `init_db()`: crea engine + `SessionLocal`, importa `models` e fa
  `Base.metadata.create_all(engine)` (no Alembic per ora).
- `_normalize_database_url()`: mappa schema `postgres://` o `postgresql://` a
  `postgresql+psycopg://` (driver psycopg v3).
- `get_db()`: dependency che yield-a una `Session` e la chiude.

### 6.3 [models.py](backend/app/models.py)

Vedi [§7 Database & schema](#7-database--schema).

### 6.4 [clerk_auth.py](backend/app/clerk_auth.py)

- `verify_clerk_token(token)`: usa `PyJWKClient` per recuperare la chiave dal JWKS Clerk e
  decodificare il JWT in RS256. Issuer atteso = `CLERK_ISSUER` (se valorizzato).
- `fetch_clerk_user(clerk_user_id)`: chiama `GET /v1/users/{id}` su Clerk Backend API
  passando `CLERK_SECRET_KEY` come Bearer; usato per arricchire profilo (email, name,
  image_url).
- `_upsert_user(...)`: cerca/crea la riga `users` per `clerk_id`, aggiorna i campi
  modificati e setta `last_login_at`.
- `get_current_user`: dependency FastAPI. Estrae `Authorization: Bearer …`, verifica il
  token, fa upsert dell'utente, ritorna il `User` ORM.
- `auth_disabled=True` (solo dev): salta tutta la verifica e lavora con un `User` fittizio
  (`clerk_id="dev-anonymous"`).

### 6.5 [services.py](backend/app/services.py)

Wrapper OpenAI:

- `_client()`: istanzia `OpenAI(api_key=…)`.
- `generate_styling_image(...)`: chiama `client.images.edit(...)` con il portrait come
  `image=`. `quality=` viene passato solo se l'SDK lo supporta; in caso di `TypeError`
  retry senza il parametro (compatibilità con versioni vecchie).
- Decodifica `b64_json`, fallback su `url` con `httpx`.

### 6.6 [main.py](backend/app/main.py)

App FastAPI. Highlights:

- `lifespan`: chiama `init_db()` allo startup → tabelle create se mancano.
- CORS configurato dalle settings.
- Schemas Pydantic: `UserOut`, `UserUpdate`, `GenerationOut`.
- Tutte le rotte `/api/me*` e `/api/report` richiedono `Depends(get_current_user)`.

### 6.7 [run.py](backend/run.py)

Avvia uvicorn con reload su `0.0.0.0:8000`.

---

## 7. Database & schema

### Tabella `users`

| Campo | Tipo | Note |
|---|---|---|
| `id`             | `INTEGER PK`         | autoincrement |
| `clerk_id`       | `VARCHAR(255) UNIQUE`| `sub` del JWT Clerk |
| `email`          | `VARCHAR(320)`       | indicizzato |
| `first_name`     | `VARCHAR(120)`       | da Clerk |
| `last_name`      | `VARCHAR(120)`       | da Clerk |
| `age`            | `INTEGER`            | inserito dall'utente via PATCH /api/me |
| `image_url`      | `VARCHAR(500)`       | avatar Clerk |
| `created_at`     | `TIMESTAMP`          | default now |
| `updated_at`     | `TIMESTAMP`          | onupdate now |
| `last_login_at`  | `TIMESTAMP`          | aggiornato a ogni richiesta autenticata |

### Tabella `generations`

| Campo | Tipo | Note |
|---|---|---|
| `id`                   | `INTEGER PK`         | |
| `user_id`              | `INTEGER FK→users`   | `ON DELETE CASCADE` |
| `report_type`          | `VARCHAR(64)`        | una delle chiavi di `PROMPT_BY_REPORT` |
| `size`                 | `VARCHAR(32)`        | es. `1024x1536` |
| `quality`              | `VARCHAR(32)`        | `low`/`medium`/`high`/`auto` |
| `prompt`               | `TEXT`               | prompt usato |
| `portrait_mime`        | `VARCHAR(64)`        | mime del file caricato |
| `portrait_size_bytes`  | `INTEGER`            | dimensione upload |
| `image_b64`            | `TEXT NULL`          | nullable se `STORE_IMAGES_IN_DB=false` |
| `image_mime`           | `VARCHAR(64)`        | default `image/png` |
| `status`               | `VARCHAR(32)`        | `pending` / `success` / `failed` |
| `error_message`        | `TEXT NULL`          | popolato in caso di errore |
| `created_at`           | `TIMESTAMP`          | default now, indicizzato |

### Migrazioni

Il setup attuale usa `Base.metadata.create_all` allo startup. Per modifiche allo schema in
produzione conviene introdurre **Alembic** in un secondo momento.

---

## 8. Autenticazione Clerk

### Configurazione su Clerk

1. Crea un'application su [Clerk Dashboard](https://dashboard.clerk.com).
2. Da **API Keys** copia:
   - **Publishable key** (`pk_test_…`) → `frontend/.env` come `VITE_CLERK_PUBLISHABLE_KEY`.
   - **Secret key** (`sk_test_…`) → `backend/.env` come `CLERK_SECRET_KEY`.
3. **Frontend API** (es. `https://your-instance.clerk.accounts.dev`): valore di
   `CLERK_ISSUER` e base per `CLERK_JWKS_URL` (`<frontend-api>/.well-known/jwks.json`).
4. (Opzionale) **JWT Templates**: aggiungi claims custom (es. `email`, `image_url`) se vuoi
   evitare il round-trip a Clerk Backend API. Il backend supporta entrambe le strategie.

### Flusso

1. Frontend monta `<ClerkProvider publishableKey=…>` in [main.tsx](frontend/src/main.tsx).
2. `<SignedOut>` mostra `<SignIn />` / `<SignUp />`. `<SignedIn>` mostra l'app.
3. Per ogni richiesta autenticata il frontend invoca `useAuth().getToken()` e mette il JWT
   in `Authorization: Bearer …`.
4. Il backend verifica il token via `PyJWKClient` (chiavi cached) e fa upsert dell'utente.

### Bypass dev

Se `AUTH_DISABLED=true` nel `.env`, il backend non verifica il JWT e usa un utente fittizio
`dev-anonymous`. Utile per testare la pipeline OpenAI senza configurare Clerk.

---

## 9. API HTTP

Tutti gli endpoint (eccetto `/api/health`) richiedono `Authorization: Bearer <Clerk JWT>`.

### `GET /api/health`

```json
{
  "ok": true,
  "image_model": "gpt-image-2-2026-04-21",
  "report_types": ["full_report", "..."],
  "auth_disabled": false
}
```

### `GET /api/me`

```json
{
  "id": 12,
  "clerk_id": "user_2…",
  "email": "alice@example.com",
  "first_name": "Alice",
  "last_name": "Bianchi",
  "age": 31,
  "image_url": "https://img.clerk.com/…"
}
```

### `PATCH /api/me`

Body:
```json
{ "first_name": "Alice", "last_name": "Bianchi", "age": 31 }
```
Tutti i campi sono opzionali.

### `GET /api/me/generations?limit=20&include_image=false`

Lista delle ultime generazioni dell'utente. Settando `include_image=true` viene restituito
anche `image_b64`.

### `GET /api/me/generations/{id}`

Singola generazione completa (con `image_b64`). 404 se non appartiene all'utente.

### `POST /api/report`

`multipart/form-data`

| Campo | Tipo | Default | Descrizione |
|---|---|---|---|
| `portrait`    | file       | —              | PNG/JPG/WebP, max 10 MB |
| `report_type` | string     | `full_report`  | Una delle chiavi di `PROMPT_BY_REPORT` |
| `size`        | string     | `1024x1536`    | `1024x1024`/`1024x1536`/`1536x1024`/`auto` |
| `quality`     | string     | `high`         | `low`/`medium`/`high`/`auto` |

Risposta 200:
```json
{
  "id": 7,
  "report_type": "full_report",
  "image_b64": "iVBORw0…",
  "mime_type": "image/png"
}
```

| Status | Caso |
|---|---|
| 401 | Token mancante / invalido |
| 400 | `report_type` non valido |
| 413 | Upload > `MAX_UPLOAD_MB` |
| 415 | MIME non in lista permessa |
| 502 | Errore OpenAI / generazione |

---

## 10. Prompt library

Vedi [backend/app/prompts.py](backend/app/prompts.py). Tutti i prompt iniziano con
`_BASE_IDENTITY_LOCK` (preservazione identità) e specificano cosa il modello può modificare
+ il layout dell'output.

| Chiave | Output |
|---|---|
| `full_report`     | Infografica completa |
| `color_analysis`  | Color season + swatches + comparazioni |
| `hairstyle_woman` | 5 hairstyle femminili + best match |
| `hairstyle_man`   | 5 hairstyle maschili + best match |
| `outfit_woman`    | 5 outfit board femminili + signature |
| `outfit_man`      | 5 outfit board maschili + signature |
| `accessories`     | Chart accessori + formula finale |
| `before_after`    | Side-by-side con label sul "dopo" |

---

## 11. Frontend — moduli

### 11.1 [main.tsx](frontend/src/main.tsx)
Bootstraps `<ClerkProvider>` con la `VITE_CLERK_PUBLISHABLE_KEY` e tema in linea con il
brand (gold #c9a96a su sfondo neutro scuro).

### 11.2 [App.tsx](frontend/src/App.tsx)
Composto da:
- `Header` — brand + `<UserButton>` quando loggato.
- `<SignedOut><AuthGate /></SignedOut>` — tabs "Sign in" / "Create account" con
  `<SignIn>`/`<SignUp>` di Clerk.
- `<SignedIn><Studio /></SignedIn>` — area autenticata con:
  - `ProfileCard`: form per nome/cognome/età, persistito su `/api/me`.
  - `Generator`: dropzone + selettori + chiamata `/api/report`.
  - `HistoryList`: ultime generazioni dell'utente (cliccabili in futuro per riapertura).

### 11.3 [api.ts](frontend/src/api.ts)
Client REST tipizzato. Ogni funzione accetta `getToken: () => Promise<string|null>` (passato
da `useAuth()`); aggiunge `Authorization: Bearer …` automaticamente. Errori del backend
(`detail`) vengono propagati come `Error.message`.

### 11.4 [styles.css](frontend/src/styles.css)
Tema dark con accenti gold. Aggiunti stili per `header-row`, `auth-gate`, `auth-tabs`,
`form-row`, `history`, `pill` (`success`/`failed`/`pending`).

### 11.5 [vite.config.ts](frontend/vite.config.ts)
Plugin React + proxy `/api` → `http://localhost:8000`. In produzione usa un reverse proxy
o riscrivi le URL via env.

---

## 12. Configurazione

### Backend `.env`

```
OPENAI_API_KEY=sk-…
OPENAI_IMAGE_MODEL=gpt-image-2-2026-04-21
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
MAX_UPLOAD_MB=10

DATABASE_URL=postgresql://user:pass@host:5432/dbname

CLERK_JWKS_URL=https://your-instance.clerk.accounts.dev/.well-known/jwks.json
CLERK_ISSUER=https://your-instance.clerk.accounts.dev
CLERK_SECRET_KEY=sk_test_…

AUTH_DISABLED=false
STORE_IMAGES_IN_DB=true
```

### Frontend `.env`

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…

# Backend base URL.
# Empty in dev: the Vite proxy forwards /api -> http://localhost:8000.
# In production set to the deployed backend origin (e.g. https://api.styletwin.app).
VITE_API_BASE_URL=
```

The frontend client ([src/api.ts](frontend/src/api.ts)) prefixes every request with
`VITE_API_BASE_URL` when set, otherwise falls back to relative `/api/...` paths so the Vite
dev proxy or a same-origin reverse proxy can route them.

---

## 13. Avvio locale

### Prerequisiti
- Python ≥ 3.10
- Node ≥ 18
- Database Postgres raggiungibile (es. Railway → `DATABASE_URL`)
- Account Clerk (publishable + secret key, frontend API URL)
- API key OpenAI con accesso a `gpt-image-2-2026-04-21`

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # macOS / Linux
pip install -r requirements.txt
cp .env.example .env              # poi inserisci i valori
python run.py
```

Verifica: `curl http://localhost:8000/api/health`.
Allo startup le tabelle `users` e `generations` vengono create se non esistono.

### Frontend

```bash
cd frontend
cp .env.example .env              # inserisci VITE_CLERK_PUBLISHABLE_KEY
npm install
npm run dev
```

Apri `http://localhost:5173` → sign-up → carica un ritratto → genera report.

---

## 14. Estensioni future

- **Storage immagini esterno** (S3/Supabase Storage) invece di base64 in DB.
- **Alembic** per migrazioni versionate (sostituire `create_all`).
- **Rate limiting** per utente (es. n generazioni / giorno) — middleware o Redis.
- **Webhook Clerk** (`user.created`, `user.updated`, `user.deleted`) per sincronizzare il
  profilo senza dipendere dall'arricchimento on-login.
- **Multi-step refinement** con `previous_response_id` per iterare sull'output.
- **Quote / billing** legate al piano Clerk Organizations / Stripe.
- **i18n** UI (IT/EN); i prompt restano in inglese per qualità del modello.
- **Test**: pytest + httpx AsyncClient per gli endpoint, mock di Clerk e OpenAI.
