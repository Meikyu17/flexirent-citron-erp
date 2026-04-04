# Deploiement VPS partage

Ce guide est prevu pour un VPS sur lequel d'autres sites tournent deja.

## Ce qu'il faut retenir

- Ne pas utiliser `docker-compose.yml` sur un VPS partage si `80/443` sont deja pris.
- Utiliser `docker-compose.vps.yml`, qui expose seulement l'app sur `127.0.0.1:${APP_PORT}`.
- Laisser ton reverse proxy existant (`Nginx` ou `Caddy`) gerer HTTPS pour le nouveau sous-domaine.
- La base PostgreSQL reste privee dans Docker.
- Le flux iCal fonctionnera si l'app est servie en HTTPS avec le bon sous-domaine public et que le proxy transmet bien `Host` et `X-Forwarded-Proto`.

## Cas `citronlocation.fr` avec deux serveurs

Configuration que tu m'as donnee:

- le site vitrine `citronlocation.fr` reste sur le serveur A
- l'admin ERP tourne sur le serveur B
- tu voudrais exposer l'admin sur `citronlocation.fr/admin`
- le domaine est gere chez Hostinger

Point important:

- Hostinger peut gerer le DNS du domaine
- le DNS sait envoyer un domaine ou un sous-domaine vers une IP
- le DNS ne sait pas router un chemin comme `/admin`

Donc:

- `citronlocation.fr` peut pointer vers le serveur A
- `admin.citronlocation.fr` peut pointer vers le serveur B
- mais `citronlocation.fr/admin` ne peut pas etre "pointe" directement vers le serveur B depuis Hostinger

Si tu veux absolument `citronlocation.fr/admin`, il faut que le serveur A joue le role de proxy inverse et transmette tout le trafic `/admin` vers le serveur B.

## Recommandation retenue

Pour ton cas, la solution a retenir est:

1. `citronlocation.fr` reste sur le serveur A pour le site vitrine
2. `admin.citronlocation.fr` pointe vers le serveur B pour l'ERP
3. l'iCal utilise `https://admin.citronlocation.fr/api/dispatch/ical?token=...`

Pourquoi je te recommande ce schema:

- pas de proxy inter-serveurs complexe entre A et B
- pas de conflit entre le site vitrine et l'admin
- configuration DNS simple chez Hostinger
- configuration Next.js plus simple
- iCal plus stable pour Google Agenda

## Si tu tiens a `citronlocation.fr/admin`

Cette option est possible, mais elle impose deux contraintes techniques:

1. le serveur A doit proxyfier `/admin` vers le serveur B
2. l'application Next doit etre adaptee pour fonctionner sous un sous-chemin `/admin`

Aujourd'hui, cette application n'est pas encore prete pour un hebergement sous `/admin` tel quel:

- elle utilise beaucoup de routes absolues comme `/login`, `/api/auth/login`, `/settings`, `/todo`
- elle n'a pas de `basePath` configure dans `next.config.ts`
- le middleware d'auth et plusieurs redirections supposent que l'app est montee a la racine `/`

En clair:

- `citronlocation.fr/admin` n'est pas juste une regle DNS
- c'est un vrai chantier d'integration entre le serveur A et l'application Next.js

## Architecture retenue pour ton cas

### Sous-domaine admin

- Hostinger DNS:
  - `A` record `@` -> IP du serveur A
  - `A` record `admin` -> IP du serveur B
- Serveur A:
  - heberge uniquement le site vitrine `citronlocation.fr`
- Serveur B:
  - heberge l'ERP sur `admin.citronlocation.fr`
  - deploie l'app avec `docker-compose.vps.yml`
  - reverse proxy local vers `127.0.0.1:3002`

### Option alternative plus lourde: chemin `/admin`

- Hostinger DNS:
  - `A` record `@` -> IP du serveur A
- Serveur A:
  - sert `citronlocation.fr`
  - proxy `/admin` vers le serveur B
- Serveur B:
  - recoit le trafic de l'ERP
  - l'app doit etre rebuild avec `basePath: "/admin"` et les routes doivent etre verifiees

## Consequence sur l'iCal

Le flux iCal public est genere a partir du domaine de la requete.

Donc:

- si tu utilises `admin.citronlocation.fr`, l'URL iCal sera de type `https://admin.citronlocation.fr/api/dispatch/ical?token=...`
- si tu utilises `citronlocation.fr/admin`, il faudra que l'app soit completement compatible `basePath=/admin`, sinon les URLs generees et certains appels client risquent d'etre faux

Pour Google Agenda, la version sous-domaine est la plus fiable.

## Checklist Hostinger

Dans Hostinger, zone DNS de `citronlocation.fr`:

1. laisse `@` pointer vers l'IP du serveur A
2. ajoute `admin` en type `A` vers l'IP publique du serveur B
3. attends la propagation DNS
4. verifie:

```bash
dig +short citronlocation.fr
dig +short admin.citronlocation.fr
```

Tu dois obtenir:

- `citronlocation.fr` -> IP du serveur A
- `admin.citronlocation.fr` -> IP du serveur B

## Configuration finale du serveur B

Pour ton serveur B `193.168.146.217`, voici la configuration a appliquer.

### 1. DNS Hostinger

Tu dois avoir cet enregistrement:

- `Type`: `A`
- `Nom`: `admin`
- `Pointe vers`: `193.168.146.217`
- `TTL`: `14400`

### 2. Variables applicatives sur le serveur B

Dans `.env.docker` sur le serveur B, mets au minimum:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=remplace-par-un-secret-fort
POSTGRES_DB=citron_erp
DATABASE_URL=postgresql://postgres:remplace-par-un-secret-fort@db:5432/citron_erp?schema=public

AUTH_SECRET=remplace-par-un-secret-long-et-aleatoire

CITRON_MANAGER_EMAIL=manager@citronlocation.fr
CITRON_MANAGER_PASSWORD=remplace-par-un-mot-de-passe-fort
CITRON_OPERATOR_EMAIL=dispatch@citronlocation.fr
CITRON_OPERATOR_PASSWORD=remplace-par-un-mot-de-passe-fort

DOMAIN=admin.citronlocation.fr
APP_PORT=3002
TZ=Europe/Paris
```

### 3. Demarrage Docker sur le serveur B

```bash
cd /srv
git clone <ton-repo> citron-erp
cd citron-erp
cp .env.docker.example .env.docker
# edite ensuite .env.docker
./scripts/deploy-vps.sh
```

### 4. Reverse proxy recommande sur le serveur B: Caddy

Si tu n'as encore rien d'installe sur le serveur B, je te recommande `Caddy` car il gere HTTPS automatiquement.

Le fichier pret a copier-coller est:

- `deploy/server-b.caddyfile`

Contenu:

```caddy
admin.citronlocation.fr {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3002
}
```

Exemple d'installation et d'activation:

```bash
sudo apt update
sudo apt install -y caddy
sudo cp /srv/citron-erp/deploy/server-b.caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy
```

### 5. Alternative si ton serveur B utilise deja Nginx

Le fichier pret a copier-coller est:

- `deploy/server-b.nginx.conf`

Exemple d'activation:

```bash
sudo cp /srv/citron-erp/deploy/server-b.nginx.conf /etc/nginx/sites-available/admin.citronlocation.fr
sudo ln -s /etc/nginx/sites-available/admin.citronlocation.fr /etc/nginx/sites-enabled/admin.citronlocation.fr
sudo nginx -t
sudo systemctl reload nginx
```

Si tu utilises Nginx, il faudra aussi creer le certificat TLS pour `admin.citronlocation.fr`, par exemple avec Certbot.

### 6. Pare-feu du serveur B

Si `ufw` est actif sur le serveur B:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### 7. Verification finale

Depuis le serveur B:

```bash
docker compose -f docker-compose.vps.yml --env-file .env.docker ps
curl -I http://127.0.0.1:3002/login
curl -I https://admin.citronlocation.fr/login
```

Puis pour l'iCal:

```bash
docker compose -f docker-compose.vps.yml --env-file .env.docker exec -e ICAL_BASE_URL=https://admin.citronlocation.fr app npm run db:seed:dispatch-ical:test
curl -I "https://admin.citronlocation.fr/api/dispatch/ical?token=COLLE_ICI_UN_TOKEN"
```

Tu dois obtenir:

- une page de login accessible sur `https://admin.citronlocation.fr/login`
- une reponse `200` sur le flux iCal
- un `Content-Type: text/calendar; charset=utf-8` pour l'URL iCal

### 8. Resume ultra simple

Sur `193.168.146.217`:

1. deployer l'app avec `./scripts/deploy-vps.sh`
2. mettre `DOMAIN=admin.citronlocation.fr`
3. exposer l'app seulement en local sur `127.0.0.1:3002`
4. faire pointer `admin.citronlocation.fr` vers `127.0.0.1:3002` avec Caddy ou Nginx
5. verifier `https://admin.citronlocation.fr/login`

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
