# BrainVault

Persoenliche Knowledge Base – Angular 19 + NestJS + PostgreSQL.

## Schnellstart (Docker)

```bash
docker compose up --build
```

- Frontend:    http://localhost:4200
- Backend API: http://localhost:3000/api
- Swagger:     http://localhost:3000/api/docs

## Lokale Entwicklung

### Voraussetzungen
- Node.js 20+
- PostgreSQL 16 (oder via Docker: `docker compose up db`)

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
ng serve
```

### Seed-Daten einspielen

```bash
cd backend
npx ts-node src/seed.ts
```

## Projektstruktur

```
brainvault/
├── backend/                 # NestJS REST API
│   └── src/
│       ├── spaces/          # Spaces (CRUD)
│       ├── pages/           # Pages (CRUD)
│       └── seed.ts          # Demo-Daten
├── frontend/                # Angular 19 SPA
│   └── src/app/
│       ├── core/            # Models & Services
│       └── features/        # Layout-Komponente
└── docker-compose.yml
```

## Technologie-Stack

| Schicht    | Technologie                        |
|------------|------------------------------------|
| Frontend   | Angular 19, SCSS, Signals          |
| Backend    | NestJS 10, TypeORM 0.3             |
| Datenbank  | PostgreSQL 16                      |
| Deploy     | Docker Compose + nginx             |
