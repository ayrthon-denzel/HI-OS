# HI OS Security Baseline

HI OS traite potentiellement des données commerciales, des documents clients et des connexions à des services externes. La sécurité suit une approche de défense en profondeur.

## Principes obligatoires
- Aucun secret, mot de passe, token OAuth ou clé API dans GitHub ou dans le frontend.
- Secrets uniquement dans le gestionnaire d'environnement de l'hébergeur.
- OAuth/délégation plutôt que collecte de mots de passe client.
- Authentification multifacteur pour les comptes administrateurs.
- RBAC : CEO, Admin Ops, Agent Service, Client Viewer.
- Permissions A0 à A3 appliquées côté serveur, jamais seulement dans l'interface.
- Isolation multi-tenant stricte avec `tenant_id` et contrôles d'accès serveur sur chaque ressource.
- Journaux d'audit pour les actions externes, changements de permissions, connexions et accès aux données sensibles.
- Chiffrement TLS en transit et chiffrement des tokens/données sensibles au repos.
- Validation de toutes les entrées, listes blanches d'actions et contrôle des types de fichiers.
- Rate limiting, protection contre brute force, sessions courtes et rotation des tokens.
- En-têtes HTTP stricts : CSP, HSTS, anti-clickjacking, nosniff et politiques cross-origin.
- Sauvegardes, restauration testée et plan de révocation des intégrations.
- Dépendances verrouillées et mises à jour de sécurité régulières.

## Séparation des responsabilités
Un agent ne reçoit que les outils indispensables à sa mission. Les agents de création n'accèdent pas aux emails clients. Les agents de prospection ne disposent pas de droits financiers. Les agents d'exécution ne peuvent pas modifier leurs propres permissions.

## Actions A3 toujours humaines
- Paiement ou remboursement
- Modification importante des prix
- Contrat ou engagement juridique
- Changement des permissions d'un administrateur
- Export massif ou suppression définitive de données
- Connexion d'une nouvelle source contenant des données sensibles
- Publication ou envoi à fort risque réputationnel

## Incident response
En cas de suspicion : suspendre le compte/intégration concerné, révoquer les tokens, figer les journaux, isoler la mission, remplacer les secrets compromis et restaurer depuis une sauvegarde propre si nécessaire.

## Limite de garantie
Aucun service connecté à Internet ne peut être garanti invulnérable. L'objectif de HI OS est de réduire la surface d'attaque, empêcher les accès latéraux, limiter l'impact d'un incident et permettre une détection/révocation rapide.
