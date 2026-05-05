# Repository Guidelines

## Project Structure & Module Organization
`frontend/` contains the Angular 21 SPA. Main app code lives in `frontend/src/app`, organized into `core/` for API clients and models, `features/` for page-level flows, and `shared/` for reusable UI, directives, pipes, and utilities. Static assets live in `frontend/public/`.

`backend/` contains the NestJS 11 API. Source files are under `backend/src`, grouped by feature (`spaces/`, `pages/`, `assets/`, `settings/`, `health/`) plus `config/` and `database/` for environment validation, TypeORM setup, and migrations.

## Build, Test, and Development Commands
- `docker compose up --build`: start frontend, backend, and database together.
- `cd backend && npm install && npm run start:dev`: run the API with file watching.
- `cd frontend && npm install && npm start`: run the Angular dev server on `:4200` with API proxying.
- `cd backend && npm run build`: compile the NestJS app to `dist/`.
- `cd frontend && npm run build`: create a production Angular build.
- `cd backend && npm run migration:run`: apply pending TypeORM migrations.
- `cd backend && npm run seed`: load idempotent seed data.

## Coding Style & Naming Conventions
Use TypeScript throughout with 2-space indentation and trailing commas where the codebase already uses them. Match framework naming patterns: Angular files use `*.component.ts|html|scss`, `*.service.ts`, and `*.spec.ts`; NestJS files use `*.controller.ts`, `*.service.ts`, `*.module.ts`, `dto/`, `entities/`, and `mappers/`. Prefer descriptive class names such as `PageViewComponent` and `SpacesService`. No dedicated lint or Prettier config is checked in, so keep edits consistent with nearby files.

## Testing Guidelines
Frontend tests use Karma + Jasmine; backend tests use Jest with `*.spec.ts` naming. Keep unit tests next to the code they cover. Run `cd frontend && npm test` and `cd backend && npm test` before opening a PR. Use `cd backend && npm run test:cov` when changing business logic, validation, or migrations.

## Commit & Pull Request Guidelines
Recent history uses short, imperative subjects such as `fix mobile sidebar focusability when closed`. Keep commit messages focused on one change and avoid bundling frontend and backend refactors together unless required.

PRs should include a concise summary, testing notes, linked issues when applicable, and screenshots or short recordings for UI changes. Mention any migration, seed, or `.env` impact explicitly.

## Configuration Tips
Copy `backend/.env.example` to `backend/.env` for local API work. The frontend calls `/api`; local proxying is defined in `frontend/proxy.conf.json`, while Docker uses nginx for the same route.
