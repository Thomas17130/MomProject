# Site ManouCréa

## Démarrer le site

Le catalogue, l'administration et l'envoi du formulaire nécessitent le serveur Node.js. N'ouvrez pas les pages HTML directement dans le navigateur.

1. Installez Node.js 20 ou une version LTS plus récente.
2. Dans ce dossier, installez les dépendances verrouillées avec `npm ci`.
3. Copiez `.env.example` vers `.env`.
4. Dans `.env`, remplacez les valeurs d'exemple. `SESSION_SECRET` doit contenir au moins 32 caractères aléatoires et `ADMIN_PASSWORD` au moins 16 caractères. Générez un secret avec `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` et choisissez un mot de passe unique dans un gestionnaire de mots de passe.
5. Lancez `npm start`, puis ouvrez `http://localhost:3000`.

La page d'administration est accessible directement à `http://localhost:3000/admin.html` ; aucun lien vers elle n'est affiché aux visiteurs. Ajoutez cette adresse à vos favoris pour y accéder facilement. L'adresse n'est pas une protection : l'accès reste protégé par le mot de passe administrateur.

## Configuration e-mail

Le formulaire envoie les messages depuis le serveur avec SMTP et utilise l'adresse saisie par le visiteur comme adresse de réponse. Renseignez `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` et `CONTACT_TO` dans `.env`. Ces paramètres sont fournis par votre hébergeur e-mail. Sans ces valeurs, le site signale que l'envoi n'est pas configuré.

Ne publiez jamais `.env` et ne partagez pas le mot de passe SMTP. En production, configurez ces variables dans l'espace sécurisé de votre hébergeur et servez le site en HTTPS.

## Sécurité et mise en production

- Les réponses appliquent des en-têtes de sécurité et une politique CSP. Les formulaires vérifient l'origine, limitent la taille des requêtes et appliquent une limitation de débit.
- Utilisez HTTPS en production. Le cookie d'administration est alors `Secure`, `HttpOnly`, `SameSite=Strict`, limité à `/` et protégé par le préfixe `__Host-`.
- Définissez `NODE_ENV=production` dans la configuration de l'hébergeur pour activer les protections spécifiques à la production ; gardez `NODE_ENV=development` uniquement en local.
- `TRUST_PROXY_HOPS` vaut `0` par défaut. Derrière un reverse proxy HTTPS, réglez-le sur le nombre exact de proxies de confiance entre Internet et l'application. Ne l'activez pas si les clients peuvent se connecter directement au serveur.
- Le stockage de session est en mémoire, borné et nettoyé automatiquement. Il convient à une seule instance : les sessions disparaissent au redémarrage. Pour plusieurs instances ou une disponibilité persistante, configurez un stockage de sessions partagé et un stockage partagé pour les limites de débit auprès de l'hébergeur.
- Placez l'application derrière le proxy HTTPS de l'hébergeur ou un service de protection adapté, et n'exposez publiquement que le port HTTPS. Une application seule ne peut pas garantir une protection contre les attaques volumétriques ou les indisponibilités de son fournisseur.
- Avant chaque publication, exécutez `npm test` et `npm audit`. N'exposez pas le serveur d'administration ou le port Node directement si votre hébergeur fournit un proxy HTTPS.
- Sauvegardez `data/products.json` et gardez les dépendances à jour. Le formulaire de contact nécessite une configuration SMTP valide.

## Catalogue et administration

- `catalogue.html` : recherche et filtres par Noël, Baptême, Mariage, Plaisir d'offrir, Anniversaire, Déco, Bien-être et Composition.
- `produit.html` : fiche détaillée ouverte depuis le catalogue, avec photo, description, prix et référence.
- `admin.html` : connexion, création, modification et suppression de produits.
- `data/products.json` : données du catalogue, modifiées par le serveur et partagées par les visiteurs.

Les images des produits sont renseignées par URL HTTPS dans l'administration. Faites une copie de `data/products.json` avant toute migration ou déploiement. Pour une mise en production avec plusieurs instances serveur, utilisez un stockage de sessions persistant en plus de la base produit.
