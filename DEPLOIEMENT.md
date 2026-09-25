# Publier DepanNow sur Internet

Le projet est prêt pour Render en tant que Web Service Node.js.

## 1. Préparer le code

Décompresse le projet puis mets son contenu dans un dépôt GitHub privé ou public que tu contrôles.

## 2. Créer le service

Dans Render :
- New → Web Service
- Connecter le dépôt GitHub
- Le fichier `render.yaml` peut servir de configuration.
- Le service utilise Node.js, `npm install` puis `npm start`.
- Le contrôle de santé est `/api/health`.

Render attribue une URL `onrender.com` au service. Un domaine personnalisé peut ensuite être ajouté.

## 3. Données

Cette version utilise SQLite et le fichier de base est dans `/app/data`.
Le `render.yaml` prévoit donc un disque persistant de 1 Go. Sans stockage persistant, les données locales peuvent être perdues lors d'un redéploiement.

Pour une forte croissance, migrer ensuite vers PostgreSQL.

## 4. Variables secrètes

Dans Render, renseigner :
- `JWT_SECRET` : une longue valeur secrète (Render peut la générer).
- `ADMIN_EMAIL` : ton adresse d'administration.
- `ADMIN_PASSWORD` : un mot de passe fort.
- `SEED_DEMO=false` pour une vraie mise en production.

Ne mets jamais ces secrets dans GitHub.

## 5. Après le déploiement

Tester :
- `https://TON-DOMAINE/api/health`
- puis la page d'accueil.

Le résultat attendu pour `/api/health` contient `ok: true`.

## 6. Domaine personnalisé

Dans le service Render, ajoute ton domaine personnalisé dans les réglages de domaine. Render indique les enregistrements DNS à créer chez ton registrar.

## 7. Avant d'ouvrir largement le service

À faire avant une grosse audience :
- vérifier les professionnels inscrits ;
- ajouter une politique de confidentialité et des conditions d'utilisation ;
- ajouter anti-spam/rate limiting ;
- ajouter sauvegardes et surveillance ;
- prévoir PostgreSQL pour la montée en charge ;
- ajouter notifications (SMS/push/WhatsApp) si nécessaire.

## Limitation importante

Je peux préparer les fichiers et la configuration, mais je ne peux pas créer un compte Render/GitHub à ton nom, accepter leurs conditions ou utiliser tes identifiants à ta place. La dernière étape nécessite donc ton action sur tes propres comptes.
