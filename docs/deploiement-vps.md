# Deploiement VPS partage

Ce guide est prevu pour un VPS sur lequel d'autres sites tournent deja.

## Ce qu'il faut retenir

- Ne pas utiliser `docker-compose.yml` sur un VPS partage si `80/443` sont deja pris.
- Utiliser `docker-compose.vps.yml`, qui expose seulement l'app sur `127.0.0.1:${APP_PORT}`.
- Laisser ton reverse proxy existant (`Nginx` ou `Caddy`) gerer HTTPS pour le nouveau sous-domaine.
- La base PostgreSQL reste privee dans Docker.
- Le flux iCal fonctionnera si l'app est servie en HTTPS avec le bon sous-domaine public et que le proxy transmet bien `Host` et `X-Forwarded-Proto`.

## Architecture recommandee

Choisis un sous-domaine dedie, par exemple `erp.tondomaine.fr`.

Topologie conseillee:

1. `erp.tondomaine.fr` pointe en DNS vers ton VPS.
2. Ton reverse proxy existant termine TLS sur `erp.tondomaine.fr`.
3. Le reverse proxy redirige vers `127.0.0.1:3002`.
4. Le conteneur `app` Next.js ecoute sur `3000` a l'interieur de Docker.
5. Le conteneur `db` PostgreSQL n'est jamais expose publiquement.
6. Le flux iCal public passe par `https://erp.tondomaine.fr/api/dispatch/ical?token=...`.

Cette topologie evite les conflits avec tes deux autres sites et garde les cookies d'auth compatibles production.

## Prerequis

- Un sous-domaine libre, par exemple `erp.tondomaine.fr`
- Docker et `docker compose` installes sur le VPS
- Un reverse proxy deja present sur le VPS (`Nginx` ou `Caddy`)
- Les ports `80/443` deja geres par ce reverse proxy

## 1. Preparation du serveur

Clone le repo sur le VPS, par exemple dans `/srv/citron-erp`:

```bash
cd /srv
git clone <ton-repo> citron-erp
cd citron-erp
```

Prepare le fichier d'environnement:

```bash
cp .env.docker.example .env.docker
```

## 2. Variables a configurer

Edite `.env.docker` et renseigne au minimum:

- `POSTGRES_PASSWORD`: mot de passe PostgreSQL fort
- `DATABASE_URL`: doit garder `@db:5432`, pas `localhost`
- `AUTH_SECRET`: secret long et aleatoire
- `CITRON_MANAGER_EMAIL`
- `CITRON_MANAGER_PASSWORD`
- `CITRON_OPERATOR_EMAIL`
- `CITRON_OPERATOR_PASSWORD`
- `DOMAIN=erp.tondomaine.fr`
- `APP_PORT=3002`
- `TZ=Europe/Paris`

Exemple minimal:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=remplace-par-un-secret-fort
POSTGRES_DB=citron_erp
DATABASE_URL=postgresql://postgres:remplace-par-un-secret-fort@db:5432/citron_erp?schema=public

AUTH_SECRET=remplace-par-un-secret-long-et-aleatoire

CITRON_MANAGER_EMAIL=manager@tondomaine.fr
CITRON_MANAGER_PASSWORD=remplace-par-un-mot-de-passe-fort
CITRON_OPERATOR_EMAIL=dispatch@tondomaine.fr
CITRON_OPERATOR_PASSWORD=remplace-par-un-mot-de-passe-fort

DOMAIN=erp.tondomaine.fr
APP_PORT=3002
TZ=Europe/Paris
```

Important:

- `DATABASE_URL` doit viser `db`, car c'est le nom du service Docker.
- `APP_PORT` est le port local du VPS derriere le proxy. Ne l'ouvre pas publiquement.
- En production, l'auth utilise des cookies `secure`, donc sers bien l'app en HTTPS.

## 3. Demarrage Docker adapte au VPS

Le fichier `docker-compose.vps.yml` lance:

- `db`
- `migrate`
- `app`
- `db_backup`

Il ne lance pas `Caddy`, pour ne pas entrer en conflit avec tes autres sites.

Lancement initial:

```bash
./scripts/deploy-vps.sh
```

Commande equivalente:

```bash
docker compose -f docker-compose.vps.yml --env-file .env.docker up -d --build
```

Verification:

```bash
docker compose -f docker-compose.vps.yml ps
docker compose -f docker-compose.vps.yml logs -f app
docker compose -f docker-compose.vps.yml logs -f db
docker compose -f docker-compose.vps.yml logs -f migrate
```

## 4. Configuration du reverse proxy

Le point cle pour iCal est ici: l'application construit les URL de flux a partir du domaine de la requete. Il faut donc que le proxy transmette bien:

- `Host`
- `X-Forwarded-Proto`

### Option A: Nginx

Exemple de vhost pour `erp.tondomaine.fr`:

```nginx
server {
    listen 80;
    server_name erp.tondomaine.fr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name erp.tondomaine.fr;

    ssl_certificate /etc/letsencrypt/live/erp.tondomaine.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/erp.tondomaine.fr/privkey.pem;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
```

Puis:

```bash
nginx -t
systemctl reload nginx
```

### Option B: Caddy

Si ton VPS principal utilise deja Caddy:

```caddy
erp.tondomaine.fr {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3002
}
```

Puis recharge Caddy.

## 5. Checklist de validation

### Front

Depuis le VPS:

```bash
curl -I http://127.0.0.1:3002/login
curl -I https://erp.tondomaine.fr/login
```

Tu dois obtenir une reponse `200` ou `307/308` propre, pas d'erreur `502`.

### Base de donnees

Verifier que Prisma a bien applique les migrations:

```bash
docker compose -f docker-compose.vps.yml logs migrate
```

Verifier que PostgreSQL est sain:

```bash
docker compose -f docker-compose.vps.yml exec db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

### iCal

La route publique iCal ne demande pas de cookie de session, ce qui est indispensable pour Google Agenda.

Test de fumee si tu veux generer des donnees iCal de test:

```bash
docker compose -f docker-compose.vps.yml --env-file .env.docker exec -e ICAL_BASE_URL=https://erp.tondomaine.fr app npm run db:seed:dispatch-ical:test
```

Cette commande affichera des URL du type:

```text
https://erp.tondomaine.fr/api/dispatch/ical?token=...
```

Teste ensuite une URL:

```bash
curl -I "https://erp.tondomaine.fr/api/dispatch/ical?token=COLLE_ICI_UN_TOKEN"
```

Tu dois voir un `200` avec:

```text
Content-Type: text/calendar; charset=utf-8
```

Si tu vois une redirection vers `/login`, le proxy ou la route publique est mal configure.

## 6. Integration Google Agenda

Quand l'URL iCal repond bien publiquement en HTTPS:

1. Ouvre Google Agenda.
2. Va dans `Autres agendas`.
3. Choisis `Depuis l'URL`.
4. Colle l'URL iCal complete `https://erp.tondomaine.fr/api/dispatch/ical?token=...`.

Notes importantes:

- Google ne rafraichit pas instantanement les flux iCal.
- L'URL doit rester stable et publique.
- Ne regenere pas les tokens sans raison, sinon les abonnements Google existants casseront.

## 7. Mise a jour en production

Pour mettre a jour l'application sans relancer un frontal qui prend `80/443`:

```bash
cd /srv/citron-erp
git pull
./scripts/update-vps.sh
```

Commande equivalente:

```bash
docker compose -f docker-compose.vps.yml --env-file .env.docker up -d --build migrate app
```

Verification apres mise a jour:

```bash
docker compose -f docker-compose.vps.yml ps
docker compose -f docker-compose.vps.yml logs -f app
```

## 8. Sauvegardes PostgreSQL

Le service `db_backup` tourne aussi dans le mode VPS.

Verifier qu'il est actif:

```bash
docker compose -f docker-compose.vps.yml ps
```

Lister les sauvegardes:

```bash
docker compose -f docker-compose.vps.yml exec db_backup ls -lah /backups
```

## 9. Erreurs classiques a eviter

- Ne pas utiliser `scripts/deploy.sh` sur ce VPS partage: il lance le Caddy integre et essaie de prendre `80/443`.
- Ne pas mettre `localhost` dans `DATABASE_URL`: depuis le conteneur, la base s'appelle `db`.
- Ne pas exposer PostgreSQL sur Internet.
- Ne pas oublier `X-Forwarded-Proto`: sinon les URL generees pour iCal peuvent etre mauvaises.
- Ne pas tester Google Agenda avec une URL privee ou un certificat invalide.

## Resume rapide

Sur un VPS avec d'autres sites:

1. DNS `erp.tondomaine.fr` vers le VPS
2. Deploiement via `docker-compose.vps.yml`
3. Reverse proxy existant vers `127.0.0.1:3002`
4. HTTPS actif
5. Validation du front, des migrations Prisma et du flux iCal

Si ces cinq points sont bons, ton front, ta base et l'integration Google Agenda via iCal fonctionneront normalement.
