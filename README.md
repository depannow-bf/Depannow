# DepanNow V3

Plateforme de dépannage : clients et professionnels.

## Fonctionnalités
- Inscription et connexion client/professionnel
- Base SQLite persistante
- Recherche par métier, nom et quartier
- Fiches professionnelles
- Appel téléphonique direct
- Création et suivi de demandes
- Statuts de demandes
- Notes et avis après dépannage
- PWA installable sur Android
- Dockerfile pour déploiement

## Lancer sur un ordinateur
1. Installer Node.js 20 ou plus.
2. Dans ce dossier : `npm install`
3. Copier `.env.example` vers `.env` et changer JWT_SECRET.
4. `npm start`
5. Ouvrir `http://localhost:3000`

Compte professionnel de démonstration :
- e-mail : `moussa@demo.local`
- mot de passe : `demo1234`

## Mise en ligne
Le projet est prêt pour un hébergeur Node/Docker. Il faut fournir les variables d'environnement :
- PORT (généralement fourni par l'hébergeur)
- JWT_SECRET (secret long et aléatoire)

IMPORTANT : pour un vrai service public à grande échelle, remplacer SQLite par PostgreSQL, ajouter HTTPS, sauvegardes, vérification des professionnels, système de notifications et protection anti-abus.

## Données
La base est créée automatiquement dans `data/depannow.db`.
Ne jamais publier un fichier `.env` contenant un vrai secret.

## Déploiement
Voir `DEPLOIEMENT.md` et `render.yaml` pour un déploiement Render.
