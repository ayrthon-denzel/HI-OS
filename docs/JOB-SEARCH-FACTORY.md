# HI OS — Job Search Factory

## Architecture retenue

Le modèle retenu est **1 Mission Supervisor par client**, qui délègue à une cellule spécialisée. Ce modèle est plus scalable qu'un agent monolithique et permet d'isoler strictement les données, la boîte mail, le CV, les critères et l'historique de chaque client.

### Cycle d'une mission
1. Onboarding et consentement du client.
2. Connexion e-mail par OAuth ou délégation sécurisée — aucun mot de passe client n'est stocké dans HI OS.
3. Création d'un espace mission isolé.
4. Le Mission Supervisor charge le profil, le CV source, les contraintes et objectifs.
5. Job Scout recherche et qualifie les offres.
6. CV Tailor adapte le CV sans inventer de compétences.
7. Application Agent envoie ou soumet les candidatures uniquement via les canaux autorisés.
8. Inbox Watcher suit les réponses liées à la mission.
9. Le Supervisor continue en autonomie sur les refus et relances ordinaires.
10. Dès qu'un entretien, test important, question personnelle ou décision sensible apparaît, Interview Agent déclenche une escalade immédiate.

## Agents

### Mission Supervisor — A2
Responsable d'une seule mission client. Il distribue les tâches, contrôle les doublons, vérifie les preuves d'envoi, maintient le pipeline et décide des prochaines actions dans les règles validées.

### Job Scout — A1
Recherche des offres fraîches correspondant au métier, contrat, zone, niveau d'expérience, rythme et contraintes du client. Vérifie autant que possible que l'offre est encore accessible.

### CV Tailor — A1
Produit une variante ATS du CV pour chaque offre pertinente. Ne crée aucune compétence, diplôme, expérience, niveau de langue ou résultat non établi dans le profil source.

### Application Agent — A2
Prépare et envoie les candidatures par e-mail ou via les intégrations explicitement autorisées. Les portails dont les conditions interdisent l'automatisation doivent être traités avec une étape utilisateur ou une intégration officielle.

### Inbox Watcher — A2
Accède uniquement au périmètre e-mail autorisé. Classe refus, accusés de réception, demandes de documents, tests, questions et invitations. Les messages hors mission sont ignorés.

### Interview Agent — A3
Prend le relais à la première invitation à un entretien ou à toute étape exigeant une décision personnelle du candidat. Prépare le briefing, les questions probables et les éléments de réponse, puis notifie HI MARKETING et le client.

## Isolation et sécurité client
- Un `tenant_id` par client et un `mission_id` par mission.
- Aucun agent ne peut lire une autre mission sans permission explicite.
- Tokens OAuth chiffrés au repos et jamais exposés au frontend.
- Journal immuable des actions : offre, CV généré, candidature, message, réponse et escalade.
- Révocation immédiate de l'accès e-mail à la fin de la mission.
- Données minimales : ne conserver que ce qui est nécessaire à la prestation.

## Statuts de pipeline
`ONBOARDING → ACTIVE_SEARCH → QUALIFIED → CV_READY → APPLIED → FOLLOW_UP → RESPONSE → INTERVIEW → WON/CLOSED`

## Règle de silence opérationnel
HI OS ne remonte pas chaque candidature. Le client peut consulter son tableau de bord, mais les notifications proactives sont réservées aux événements significatifs : entretien, test, document indispensable, problème de compte ou décision nécessitant le candidat.

## Offre type
Le tarif commercial peut être associé à la mission (ex. 50 000 FCFA), mais les agents n'ont jamais le droit de modifier le prix ou d'accorder une remise sans autorisation A3.
