# HI OS v1 — Prototype

Premier socle de la plateforme multi-agents de HI MARKETING.

## Ouvrir le prototype
Ouvrir `index.html` dans un navigateur.

## Contenu
- Command Center
- Chat HI Orchestrator (routage simulé)
- Contract Hunter
- CRM & Sales
- Master Designer
- Social Media
- Web & Software
- Inbox
- Proposals & Devis
- Automation Center
- Analytics
- Knowledge Base
- Modal de validations humaines A3
- Brand kit basé sur l'identité HI MARKETING or/blanc + noir/bleu nuit

## API de démonstration
`python server/api_stub.py` puis POST `/orchestrate` avec `{ "command": "..." }`.

## Suite technique
Brancher PostgreSQL, authentification, queue de jobs, API IA, Gmail/Drive/Calendar, GitHub/Render, Metricool et APIs sociales. Les actions externes devront respecter la matrice A0–A3 définie dans `docs/ARCHITECTURE.md`.
