# BrainVault privat über GitHub Pipeline als Docker-Container bereitstellen

Ja – genau dafür ist jetzt eine GitHub-Actions-Pipeline enthalten.
Du pushst den Code nach GitHub, die Pipeline baut Backend/Frontend und published die Images in **GHCR** (`ghcr.io`) – und du kannst sie danach direkt per `docker pull` oder `docker compose pull` ziehen.

## Enthaltene Pipeline

- Workflow-Datei: `.github/workflows/docker-private-registry.yml`
- Buildet automatisch:
  - `ghcr.io/<owner>/brainvault-backend`
  - `ghcr.io/<owner>/brainvault-frontend`
- Trigger:
  - automatisch bei Push auf `main`
  - manuell über **Run workflow** (mit optionalem Tag)

---

## 1) Repository/Packages privat halten (wichtig)

Damit wirklich **nur du** pullen kannst:

1. Nutze ein **privates GitHub Repository**.
2. In GitHub unter **Packages** die beiden Container-Packages auf **Private** setzen (falls nötig).
3. Zugriff nur deinem eigenen Account geben (bzw. nur gezielt Accounts/Teams freigeben).

> Solange Package-Sichtbarkeit und Berechtigungen auf „Private“ stehen, ist kein öffentlicher Pull möglich.

---

## 2) Pipeline ausführen

### Variante A: automatisch

Ein Push auf `main` startet den Workflow automatisch.

### Variante B: manuell mit Versionstag

1. GitHub → **Actions** → `Build and publish private Docker images`
2. **Run workflow**
3. Optional `image_tag` setzen (z. B. `v1.0.0`)
4. Optional `publish_latest=true`

Dann werden beide Images mit deinem Tag (und optional `latest`) nach GHCR gepusht.

---

## 3) Lokal an GHCR anmelden

Du brauchst einen Token mit mindestens `read:packages` (zum Pullen).

```bash
echo <GITHUB_TOKEN> | docker login ghcr.io -u <GITHUB_USERNAME> --password-stdin
```

---

## 4) Images direkt per `docker pull` laden

```bash
docker pull ghcr.io/<owner>/brainvault-backend:<tag>
docker pull ghcr.io/<owner>/brainvault-frontend:<tag>
```

Beispiel:

```bash
docker pull ghcr.io/maxmustermann/brainvault-backend:v1.0.0
docker pull ghcr.io/maxmustermann/brainvault-frontend:v1.0.0
```

---

## 5) App per Compose aus privater Registry starten

### 5.1 Env-Datei anlegen

```bash
cp .env.registry.example .env.registry
```

Dann Werte setzen:

```dotenv
PRIVATE_REGISTRY=ghcr.io/<owner>
APP_IMAGE_TAG=v1.0.0
BACKEND_PORT=3001
```

### 5.2 Pull + Start

```bash
docker compose --env-file .env.registry -f docker-compose.registry.yml pull
docker compose --env-file .env.registry -f docker-compose.registry.yml up -d
```

---

## 6) Neue Version veröffentlichen

1. Pipeline erneut ausführen (z. B. mit `image_tag=v1.0.1`)
2. In `.env.registry` `APP_IMAGE_TAG` auf neuen Tag setzen
3. Neu ziehen + neu starten:

```bash
docker compose --env-file .env.registry -f docker-compose.registry.yml pull
docker compose --env-file .env.registry -f docker-compose.registry.yml up -d
```

---

## 7) Sicherheits-Checklist

- Repository privat
- GHCR-Packages privat
- Token nur mit minimalen Scopes (`read:packages` für Pull, `write:packages` nur wo nötig)
- Token regelmäßig rotieren
- `.env.registry` und Tokens niemals committen
