# BrainVault

Persoenliche Knowledge Base - Angular 21 + NestJS 11 + PostgreSQL.

## Schnellstart (Docker)

```bash
docker compose up --build
```

- Frontend:    http://localhost:4200
- Backend API: http://localhost:3000/api
- Swagger:     http://localhost:3000/api/docs

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

## Konfiguration

`DB_MIGRATIONS_RUN` steuert, ob offene TypeORM-Migrationen beim Backend-Start automatisch laufen. Der Default ist `true`.

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
