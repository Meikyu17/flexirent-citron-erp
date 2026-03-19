# Citron ERP

ERP moderne pour agence de location automobile multi-sites (Citron Centre + Jean-Jaures).

## Ce que fait le projet

- Dashboard unique (vehicules, reservations, dispatch, KPI equipe)
- Theme clair/sombre
- Authentification avec roles (`MANAGER`, `OPERATOR`)
- Ingestion Openclaw vers PostgreSQL (`dry-run` et `upsert`)
- Generation iCal pour dispatch

## Stack technique

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4
- Prisma 6 + PostgreSQL
- Zod
- Docker Compose + Caddy (TLS auto) + backup PostgreSQL

## 1) Lancer en local (sans Docker)

### Prerequis

- Node.js 20+
- PostgreSQL local

### Commandes

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Application: `http://localhost:3000`

### Qualite et build local

```bash
npm run lint
npm run build
```

## 2) Lancer avec Docker (recommande)

### Prerequis

- Docker
- Docker Compose (`docker compose`)

### Configuration

```bash
cp .env.docker.example .env.docker
```

Puis edite `.env.docker` et ajuste au minimum:

- `DOMAIN` (ex: `erp.tondomaine.fr`)
- `POSTGRES_PASSWORD`
- `DATABASE_URL` (doit rester avec host `db`)
- `AUTH_SECRET`
- `CITRON_MANAGER_PASSWORD`
- `CITRON_OPERATOR_PASSWORD`

### Demarrage

```bash
docker compose --env-file .env.docker up -d --build
```

Ou:

```bash
./scripts/deploy.sh
```

### Verification

```bash
docker compose ps
docker compose logs -f caddy
docker compose logs -f app_blue
docker compose logs -f app_green
docker compose logs -f db
docker compose logs -f db_backup
```

### URLs

- Local: `https://localhost` (ou `http://localhost`)
- Serveur: `https://<DOMAIN>`

## 3) Deployer sur un serveur (copier-coller)

```bash
git clone <ton-repo> citron-erp
cd citron-erp
cp .env.docker.example .env.docker
# edite .env.docker
./scripts/deploy.sh
```

Architecture de prod incluse:

- Caddy en frontal (HTTPS automatique)
- `app_blue` + `app_green` (load balancing)
- PostgreSQL
- `db_backup` (backup quotidien)

## 4) Mettre a jour en production

```bash
git pull
./scripts/update.sh
```

Le script fait:

- rebuild des images app
- deploiement rolling `app_blue` puis `app_green`
- verifications finales

## 5) Commandes d'exploitation

### Etat des services

```bash
docker compose ps
```

### Redemarrer un service

```bash
docker compose restart caddy
docker compose restart app_blue
docker compose restart app_green
docker compose restart db
```

### Arreter / redemarrer toute la stack

```bash
docker compose down
docker compose --env-file .env.docker up -d
```

### Suivre les logs

```bash
docker compose logs -f caddy
docker compose logs -f app_blue
docker compose logs -f app_green
docker compose logs -f db
docker compose logs -f db_backup
```

## 6) Sauvegarde et restauration PostgreSQL

### Retention / horaire backup (dans `.env.docker`)

- `BACKUP_SCHEDULE` (par defaut `0 3 * * *`)
- `BACKUP_KEEP_DAYS`
- `BACKUP_KEEP_WEEKS`
- `BACKUP_KEEP_MONTHS`

### Lister les fichiers de backup

```bash
docker compose exec db_backup ls -lah /backups
```

### Restaurer un backup

1. Choisir le fichier `.sql.gz` dans `/backups`
2. Restaurer:

```bash
docker compose exec -T db sh -c 'gunzip -c /tmp/backup.sql.gz | psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Exemple complet (copie puis restore):

```bash
docker cp /chemin/local/backup.sql.gz "$(docker compose ps -q db)":/tmp/backup.sql.gz
docker compose exec -T db sh -c 'gunzip -c /tmp/backup.sql.gz | psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

## 7) Migrations Prisma manuelles (si besoin)

```bash
docker compose --env-file .env.docker run --rm migrate
```

## 8) Comptes demo

Definis dans `.env` ou `.env.docker`:

- Manager: `CITRON_MANAGER_EMAIL` / `CITRON_MANAGER_PASSWORD`
- Operateur: `CITRON_OPERATOR_EMAIL` / `CITRON_OPERATOR_PASSWORD`

## 9) Endpoints principaux

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/v1/openclaw/events` (ou `/api/openclaw/events`)
- `POST /api/dispatch/ical`

## 10) Documentation Openclaw

Specification complete:

- `docs/openclaw-api-integration.md`
