# Compte Sumeria — Suivi du sous-compte

PWA mobile-first (Next.js 15 + Prisma + Neon) qui suit les entrées/sorties d'un sous-compte
bancaire en lisant les emails d'alerte Gmail, avec calcul du solde courant.

**Solde courant = soldeInitial + crédits − débits** (transactions postérieures à `soldeInitialDate`).

## Stack

- Next.js 15 (App Router, TypeScript), Tailwind CSS 4
- Prisma + Neon (Postgres serverless, free tier)
- Auth : email + code PIN 8 chiffres (bcrypt), session JWT en cookie httpOnly (jose)
- Gmail API en lecture seule (googleapis, OAuth2)
- PWA : @ducanh2912/next-pwa (installable sur iOS/Android)
- Déploiement : Vercel Hobby + Vercel Cron (1×/jour)

---

## ✅ CE QUE TU DOIS FAIRE (étapes manuelles)

### 1. Créer la base Neon

1. Va sur https://neon.tech → crée un compte (gratuit) → **New Project** (région Europe, ex. Frankfurt).
2. Dans le dashboard du projet, ouvre **Connection Details** :
   - Copie la connection string **avec pooling** (host contenant `-pooler`) → `DATABASE_URL`
   - Décoche "Pooled connection" pour obtenir la string **directe** (sans `-pooler`) → `DIRECT_URL`
3. Copie `.env.example` en `.env` et colle ces deux valeurs.

### 2. Générer les secrets

Dans un terminal :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Lance-le **deux fois** : une valeur pour `SESSION_SECRET`, une pour `CRON_SECRET` (dans `.env`).

### 3. Créer le projet Google Cloud (API Gmail)

1. https://console.cloud.google.com → crée un projet (ex. "compte-sumeria").
2. **APIs & Services → Library** → cherche **Gmail API** → **Enable**.
3. **APIs & Services → OAuth consent screen** :
   - Type : **External**, remplis le minimum (nom de l'app, ton email).
   - **Scopes** : ajoute `.../auth/gmail.readonly` (facultatif à ce stade, le code le demande).
   - **Test users** : ajoute l'adresse Gmail qui reçoit les alertes bancaires.
     ⚠️ L'app peut rester en mode "Testing" pour toujours (pas besoin de validation Google),
     mais en mode Testing le refresh token expire après ~7 jours **sauf** si tu passes
     l'app en "In production" (bouton Publish app — pas de validation nécessaire pour
     un usage perso avec ce scope tant que tu ne dépasses pas 100 utilisateurs).
     👉 Recommandé : clique **Publish app** pour que le refresh token soit permanent.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** :
   - Type : **Web application**
   - **Authorized redirect URIs** — ajoute les deux :
     - `http://localhost:3000/api/gmail/callback`
     - `https://TON-APP.vercel.app/api/gmail/callback` (à compléter après le 1er déploiement)
   - Copie **Client ID** → `GOOGLE_CLIENT_ID` et **Client secret** → `GOOGLE_CLIENT_SECRET` dans `.env`.

### 4. Renseigner l'expéditeur des alertes

Dans `.env`, mets l'adresse exacte qui envoie les alertes de ta banque :

```
BANK_ALERT_SENDER="no-reply@sumeria.eu"   # vérifie dans un vrai email d'alerte !
```

### 5. Initialiser la base et les comptes

```bash
npm install
npm run db:push          # crée les tables dans Neon
npm run user:create -- ton@email.com 12345678        # toi (code à 6 ou 8 chiffres, au choix)
npm run user:create -- copine@email.com 654321       # ta copine (ici 6 chiffres)
npm run balance:set -- 1234.56 2026-09-01            # solde de départ + date de référence
```

### 6. Autoriser Gmail (une seule fois)

```bash
npm run dev
```

1. Ouvre http://localhost:3000 → connecte-toi (email + PIN).
2. Clique **"Configurer l'accès Gmail"** en bas du dashboard (ou va sur `/api/gmail/auth`).
3. Autorise avec le compte Gmail qui reçoit les alertes.
4. La page affiche le **refresh token** → colle-le dans `GMAIL_REFRESH_TOKEN` de `.env`.
5. Redémarre `npm run dev`, puis teste **"Synchroniser maintenant"** : la réponse liste
   les emails trouvés (pour l'instant ils vont dans la table `UnparsedEmail`, c'est normal —
   le parseur sera écrit avec de vrais exemples de mails).

### 7. Notifications par email (optionnel — Gmail SMTP, gratuit)

Les mails partent de ton compte Gmail via un **mot de passe d'application** (secret séparé
de l'autorisation OAuth, qui reste en lecture seule). Limite Gmail : ~500 mails/jour.

1. Sur le compte Google qui enverra les mails : https://myaccount.google.com/security →
   active la **validation en deux étapes** (obligatoire pour l'étape suivante).
2. https://myaccount.google.com/apppasswords → nom de l'app : `Sumeria` → **Créer** →
   copie le code de **16 caractères** affiché (sans les espaces).
3. Dans `.env` : `GMAIL_SMTP_USER` = l'adresse Gmail, `GMAIL_APP_PASSWORD` = le code.
4. Chaque utilisateur reçoit les mails **sur son propre email** et active/désactive
   "Mouvement sur le compte" et "Relevé mensuel" dans **Paramètres › Alertes** (menu ☰).
   Le menu permet aussi de **s'envoyer le relevé PDF** de la période affichée.
5. Laisse `GMAIL_APP_PASSWORD` vide pour désactiver complètement les emails (le reste de
   l'app fonctionne sans).

### 7 bis. Notifications push & Face ID (optionnel)

- **Push** : génère une paire de clés avec `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, et `VAPID_SUBJECT="mailto:ton.compte@gmail.com"`. Ensuite, sur le téléphone, l'appli
  installée → Paramètres › Notifications push → activer. (Indisponible en `npm run dev`, le service
  worker n'y est pas actif.)
- **Face ID / empreinte** : rien à configurer ; Paramètres › Face ID / empreinte → « Ajouter cet appareil ».
  Les clés sont liées au domaine (localhost ≠ ton-app.vercel.app) : enregistre l'appareil sur l'URL de prod.

### 8. Déployer sur Vercel

1. Pousse le projet sur GitHub (repo **privé**).
2. https://vercel.com → **Import Project** → sélectionne le repo (framework Next.js détecté).
3. **Settings → Environment Variables** : ajoute TOUTES les variables du `.env`
   (`DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REDIRECT_URI` ← avec l'URL **de prod**, `GMAIL_REFRESH_TOKEN`, `BANK_ALERT_SENDER`,
   `BANK_ACCOUNT_NAME`, `ADMIN_EMAIL`, `CRON_SECRET`, `GMAIL_SMTP_USER`, `GMAIL_APP_PASSWORD`,
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
4. Ajoute l'URL de prod dans les **redirect URIs** Google (étape 3.4).
5. Les crons (`vercel.json`) tournent : synchro 1×/jour à 7h UTC, relevé mensuel le 1er du
   mois à 8h UTC. Vercel envoie automatiquement `Authorization: Bearer $CRON_SECRET`.
   ⚠️ Le plan Vercel Hobby limite le nombre et la fréquence des crons — vérifie sur
   [vercel.com/docs/cron-jobs](https://vercel.com/docs/cron-jobs) que 2 crons quotidien/mensuel
   restent dans les limites gratuites actuelles.

### 8 bis. Synchronisation toutes les 5 minutes (cron externe gratuit)

Le cron Vercel gratuit ne tourne qu'une fois par jour ; entre deux, la synchro ne se fait que
quand l'appli est ouverte. Pour des notifications et un solde à jour appli fermée :

1. https://cron-job.org (gratuit) → **Create cronjob**.
2. URL : `https://TON-APP.vercel.app/api/sync-emails` — Schedule : *Every 5 minutes*.
3. Advanced → Request method `GET` → Headers : `Authorization` = `Bearer <valeur de CRON_SECRET>`.
4. **Run now** → statut 200 attendu (401 = secret différent de celui configuré dans Vercel).

### 8 ter. Détection instantanée (Gmail prévient l'appli — recommandé)

Remplace avantageusement le cron externe : Google appelle `/api/gmail/push` à la seconde où un
mail arrive. Gratuit à ce volume. Dans **Google Cloud Console, le même projet que l'OAuth** :

1. **APIs & Services → Library** → active **Cloud Pub/Sub API**.
2. **Pub/Sub → Topics → Create topic** : ID `gmail-sumeria`. Note le nom complet affiché,
   du type `projects/mon-projet-123456/topics/gmail-sumeria`.
3. Sur ce topic → onglet **Permissions** (ou « Add principal ») → principal
   `gmail-api-push@system.gserviceaccount.com`, rôle **Pub/Sub Publisher** → Save.
4. **Pub/Sub → Subscriptions → Create subscription** : ID `gmail-sumeria-push`, topic ci-dessus,
   **Delivery type : Push**, Endpoint URL :
   `https://TON-APP.vercel.app/api/gmail/push?token=<valeur de CRON_SECRET>`,
   Expiration period : **Never expire**. Create.
5. Vercel → Environment Variables → `GMAIL_PUBSUB_TOPIC` = le nom complet du topic → **Redeploy**.
6. Dans l'appli (compte admin) → Paramètres › Gmail (administrateur) → **Activer la détection
   instantanée**. L'abonnement Gmail dure 7 jours et est renouvelé automatiquement à chaque synchro.

Test : fais-toi un virement de 1 € → mail + notification dans les secondes qui suivent, appli fermée.

### 9. Installer la PWA sur ton téléphone

- **Android (Chrome)** : ouvre le site → menu ⋮ → "Ajouter à l'écran d'accueil" / "Installer".
- **iOS (Safari)** : ouvre le site → bouton Partager → "Sur l'écran d'accueil".

---

## Développement

```bash
npm run dev        # serveur de dev (PWA désactivée en dev)
npm run build      # build de prod (génère le service worker)
npm run db:studio  # interface web pour voir/éditer la base
npm run icons      # régénère les icônes placeholder
```

## Structure

```
app/
  page.tsx                    # dashboard (solde, transactions, synchro, filtres)
  login/page.tsx              # connexion en une page (email + PIN en cases séparées)
  manifest.ts                 # manifest PWA
  api/auth/...                # login (email + PIN en une page), logout
  api/gmail/auth, callback    # flux OAuth Google (une fois)
  api/sync-emails/route.ts    # synchro Gmail (bouton + cron)
lib/
  parseBankEmail.ts           # ⚠️ parseur à compléter avec de vrais emails
  gmail.ts                    # client Gmail + extraction du corps des mails
  session.ts                  # cookies JWT
prisma/schema.prisma          # User, Transaction, AccountConfig, UnparsedEmail
scripts/                      # create-user, set-initial-balance, generate-icons
middleware.ts                 # protection de toutes les routes
vercel.json                   # cron quotidien
```

## Prochaine étape : le parsing

`lib/parseBankEmail.ts` retourne `null` pour l'instant → chaque email atterrit dans la
table `UnparsedEmail` (visible via `npm run db:studio`). Récupère 2-3 exemples réels
(un débit, un crédit) depuis cette table et donne-les à Claude pour écrire les regex.
