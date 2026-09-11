# HI OS v1 — Architecture multi-agents

## Vision
HI OS est le système d'exploitation interne de HI MARKETING. L'utilisateur pilote l'entreprise depuis un chat central. HI Orchestrator décompose les commandes, route les tâches vers les agents spécialisés, exécute automatiquement les actions A0–A2 et demande une validation humaine pour les actions A3.

## Identité visuelle officielle
Référence retenue : logo HI MARKETING or/blanc, fonds noir / bleu nuit, accents or, signature « Digital • Software • Growth ». Toute interface, proposition ou production Master Designer doit charger le Brand Kit avant génération.

## Agents
1. HI Orchestrator — coordination et routage.
2. Contract Hunter — veille, qualification, prospection.
3. Sales Agent — relances, rendez-vous, closing courant.
4. CRM Agent — données prospects et pipeline.
5. HI Clean Growth Agent — vertical nettoyage.
6. Master Designer — création visuelle et brand compliance.
7. Social Media Manager — programmation et performances.
8. Content Strategist — stratégie éditoriale.
9. Video Agent — scripts, storyboards et production vidéo.
10. Proposal Agent — propositions commerciales.
11. Quote Agent — devis.
12. Contract Agent — contrats en brouillon uniquement.
13. Web Agent — sites web et maintenance.
14. Software Agent — apps, CRM, outils internes.
15. QA Agent — tests et blocage des releases défectueuses.
16. Project Manager Agent — planification projets.
17. Inbox Agent — Gmail et tri commercial.
18. Client Success Agent — suivi clients.
19. Finance Agent — suivi financier, sans pouvoir de paiement.
20. Analytics Agent — mesures et reporting.
21. Automation Agent — workflows, webhooks, cron, queues.
22. Knowledge Agent — mémoire officielle.
23. Security & Compliance Agent — garde-fous.

## Permissions
- A0 : lecture/analyse.
- A1 : préparation et brouillons.
- A2 : exécution autonome dans les règles validées.
- A3 : validation humaine obligatoire.

## A3 obligatoire
- signature ou acceptation contractuelle ;
- paiement, remboursement, modification bancaire ;
- remise/prix hors règles ;
- suppression irréversible ou migration destructive ;
- nouvelle direction artistique / modification du logo ;
- publication sensible ou réputationnelle ;
- engagement juridique ou commercial atypique ;
- dépenses cloud ou prestataires au-delà du seuil défini.

## Architecture technique cible
Frontend web (dashboard + pages agents + chat central) → API backend → Orchestrator → Queue de jobs → Agents spécialisés → Connecteurs externes → PostgreSQL → Audit log.

### Composants
- Frontend : Next.js/React ou équivalent.
- Backend : API Node.js/TypeScript ou Python/FastAPI.
- Base : PostgreSQL.
- Queue : Redis + worker.
- Auth : comptes + rôles + MFA.
- IA : provider configurable, prompts versionnés.
- Automations : moteur interne + n8n/webhooks.
- Fichiers : stockage objet + Drive.
- Observabilité : logs, coût IA, erreurs, audit.
- Connecteurs : Gmail, Calendar, Drive, GitHub, Render, Metricool, réseaux sociaux selon APIs autorisées.

## Règle d'or
Aucun agent ne reçoit une permission implicite. Chaque outil, action et client dispose d'une policy explicite et auditable.
