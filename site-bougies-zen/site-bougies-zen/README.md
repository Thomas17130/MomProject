# Site Lueur d'Âme

## Démarrer le site

Le catalogue, l'administration et l'envoi du formulaire nécessitent le serveur Node.js. N'ouvrez pas les pages HTML directement dans le navigateur.

1. Installez Node.js LTS.
2. Dans ce dossier, installez les dépendances avec `npm install`.
3. Copiez `.env.example` vers `.env`.
4. Dans `.env`, définissez un mot de passe administrateur unique, un secret de session aléatoire et les paramètres SMTP de votre fournisseur e-mail.
5. Lancez `npm start`, puis ouvrez `http://localhost:3000`.

La page d'administration est disponible sur `http://localhost:3000/admin.html`.

## Configuration e-mail

Le formulaire envoie les messages depuis le serveur avec SMTP et utilise l'adresse saisie par le visiteur comme adresse de réponse. Renseignez `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` et `CONTACT_TO` dans `.env`. Ces paramètres sont fournis par votre hébergeur e-mail. Sans ces valeurs, le site signale que l'envoi n'est pas configuré.

Ne publiez jamais `.env` et ne partagez pas le mot de passe SMTP. En production, configurez ces variables dans l'espace sécurisé de votre hébergeur et servez le site en HTTPS.

## Catalogue et administration

- `catalogue.html` : recherche et filtres par Noël, Baptême, Mariage, Plaisir d'offrir, Anniversaire, Déco, Bien-être et Composition.
- `produit.html` : fiche détaillée ouverte depuis le catalogue, avec photo, description, prix et référence.
- `admin.html` : connexion, création, modification et suppression de produits.
- `data/products.json` : données du catalogue, modifiées par le serveur et partagées par les visiteurs.

Les images des produits sont renseignées par URL HTTPS dans l'administration. Faites une copie de `data/products.json` avant toute migration ou déploiement. Pour une mise en production avec plusieurs instances serveur, utilisez un stockage de sessions persistant en plus de la base produit.
