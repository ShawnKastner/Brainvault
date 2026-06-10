# BrainVault

Persoenliche Knowledge Base - Angular 21 + NestJS 11 + PostgreSQL.

## Schnellstart (Docker)

```bash
docker compose up --build
```

- Frontend:    http://localhost:4200
- Backend API: http://localhost:3001/api
- Swagger:     http://localhost:3001/api/docs

Der Docker-Start umfasst PostgreSQL, Redis, Gotenberg, Backend-API,
Preview-Worker und Frontend.


## Private Registry via GitHub Pipeline (Docker Pull, nicht oeffentlich)

Backend, Frontend und das angepasste Gotenberg-Image koennen direkt ueber eine
GitHub-Actions-Pipeline privat nach GHCR gebaut und gepusht werden.

- Workflow: `.github/workflows/docker-private-registry.yml`
- Compose fuer Pull aus Registry: `docker-compose.registry.yml`
- Env-Beispiel: `.env.registry.example`
- Detaillierte Schritte (Deutsch): `docs/private-registry-deployment.md`

Kurzablauf:

```bash
# 1) Pipeline in GitHub Actions laufen lassen (build + push nach ghcr.io/<owner>/...)
cp .env.registry.example .env.registry
# 2) PRIVATE_REGISTRY und APP_IMAGE_TAG setzen
# 3) Images ziehen und starten
docker compose --env-file .env.registry -f docker-compose.registry.yml pull
docker compose --env-file .env.registry -f docker-compose.registry.yml up -d
```

Wichtig: Repository/Packages auf **private** lassen, damit nur freigegebene Accounts pullen koennen.

## Lokale Entwicklung

### Voraussetzungen
- Node.js 20.19+ oder 22.12+
- PostgreSQL 16 (oder via Docker: `docker compose up db`)

Falls du `nvm` nutzt:

```bash
nvm use
```

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

Offene Datenbank-Migrationen laufen beim Backend-Start automatisch.

### Frontend

```bash
cd frontend
npm install
npm start
```

### Seed-Daten einspielen

```bash
cd backend
npm run seed
```

Der Seed ist idempotent und kann erneut ausgefuehrt werden.

## Projektstruktur

```
brainvault/
├── backend/                 # NestJS REST API
│   └── src/
│       ├── config/          # Env-Validierung und App-Config
│       ├── database/        # TypeORM-Konfiguration
│       ├── health/          # Health Endpoint
│       ├── spaces/          # Spaces Feature
│       ├── pages/           # Pages Feature
│       └── seed.ts          # Demo-Daten
├── frontend/                # Angular 21 SPA
│   └── src/app/
│       ├── core/            # API-Services, Config, Models
│       ├── features/        # Shell, Pages Feature
│       └── shared/          # Wiederverwendbare UI/Pipes
└── docker-compose.yml
```

## Technologie-Stack

| Schicht    | Technologie                        |
|------------|------------------------------------|
| Frontend   | Angular 21, SCSS, Signals, Reactive Forms |
| Backend    | NestJS 11, TypeORM 0.3             |
| Datenbank  | PostgreSQL 16                      |
| Deploy     | Docker Compose + nginx             |

## Dokumentvorschau

Der Storage unterstützt PDF sowie Word-, Excel- und PowerPoint-Dateien. Office-Dokumente
werden asynchron durch einen separaten Worker über Gotenberg/LibreOffice in PDF
konvertiert und im vorhandenen PDF-Viewer angezeigt.

- Unterstützte Formate: `PDF`, `DOC`, `DOCX`, `XLS`, `XLSX`, `PPT`, `PPTX`
- Originaldateien bleiben unverändert herunterladbar.
- Redis speichert Queue- und Asset-IDs, aber keine Dokumentinhalte.
- Gotenberg ist nicht öffentlich erreichbar und läuft in einem internen Docker-Netz
  ohne Internetzugriff.
- LibreOffice kann Schriften und Layouts anders darstellen als Microsoft Office.

## API

- `GET /api/health`
- `GET /api/spaces`
- `POST /api/spaces`
- `PUT /api/spaces/:id` und `PATCH /api/spaces/:id`
- `DELETE /api/spaces/:id`
- `GET /api/pages`
- `GET /api/pages?spaceId=:spaceId`
- `POST /api/pages`
- `PUT /api/pages/:id` und `PATCH /api/pages/:id`
- `DELETE /api/pages/:id`
- `GET /api/assets/pdfs`
- `POST /api/assets/pdfs`
- `GET /api/assets/pdfs/:id`
- `DELETE /api/assets/pdfs/:id`
- `GET`, `POST` und `DELETE /api/assets/files`
- `POST /api/assets/files/:id/preview`
- `GET /api/assets/files/:id/preview/status`
- `GET /api/assets/files/:id/preview`

## Konfiguration

`DB_MIGRATIONS_RUN` steuert, ob offene TypeORM-Migrationen beim Backend-Start automatisch laufen. Der Default ist `true`.
`MAX_IMAGE_UPLOAD_BYTES` begrenzt Bild-Uploads, `MAX_PDF_UPLOAD_BYTES` begrenzt PDF-Uploads fuer den Storage.

Für Office-Vorschauen stehen zusätzlich `REDIS_HOST`, `REDIS_PORT`, `GOTENBERG_URL`,
`PREVIEW_CONVERSION_TIMEOUT_MS`, `MAX_PREVIEW_BYTES`,
`PREVIEW_WORKER_CONCURRENCY` und `PREVIEW_GENERATOR_VERSION` zur Verfügung.

Das lokale Gotenberg-Image enthält Fontconfig-Regeln für Office-Dokumente.
Fehlende `Aptos`- und `Aptos Display`-Schriften werden auf Arial abgebildet,
damit Textboxen deutlich näher am PowerPoint-Layout bleiben. Separat lizenzierte
Office-Fonts können vor dem Build unter `gotenberg/fonts/` abgelegt werden.
Die Fontdateien werden bewusst nicht durch Git versioniert; Details stehen in
`gotenberg/fonts/README.md`. Eine geänderte `PREVIEW_GENERATOR_VERSION` sorgt
dafür, dass bereits vorhandene Office-Vorschauen beim nächsten Öffnen neu
erzeugt werden.

Das Frontend nutzt relativ `/api`; lokal leitet `proxy.conf.json` auf `http://localhost:3000` weiter, im Docker-Setup uebernimmt nginx den Proxy zum Backend.

## Migrationen

```bash
cd backend
npm run migration:run
npm run migration:revert
npm run migration:generate -- src/database/migrations/AddMigrationName
```

Die erste Migration bildet die aktuelle DB-Struktur ab und ist so geschrieben, dass eine bereits vorhandene aktuelle Datenbank nicht neu erstellt oder geleert wird.

## Checks

```bash
cd backend
npm run build
npm test

cd ../frontend
npm run build
npm test
```
