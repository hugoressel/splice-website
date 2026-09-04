# Backend leads SPLICE — mise en service

Architecture pérenne : formulaire → Cloudflare Worker → email (Resend) + stockage (Airtable).
Aucun secret n'est stocké dans le repo. Tout passe par les variables d'environnement du Worker.

## Ce dont on a besoin de votre côté (accès à créer)

1. **Compte Cloudflare** (gratuit) pour héberger le Worker.
2. **Compte Resend** (envoi d'emails) + **vérification du domaine `splice-agency.com`**
   (ajout de quelques enregistrements DNS chez votre registrar). Sans domaine vérifié,
   les emails partiront d'une adresse générique et risquent le spam.
3. **(Optionnel) Compte Airtable** pour stocker les leads (embryon de CRM).
4. **Numéro WhatsApp / téléphone** à afficher comme canal alternatif sur le site.
5. **(Optionnel) GA4 / Meta Pixel** si vous voulez mesurer les conversions.

## Variables/secrets à définir sur le Worker

| Nom | Exemple | Secret |
|-----|---------|--------|
| ALLOWED_ORIGIN | https://splice-agency.com | non |
| RESEND_API_KEY | re_xxx | **oui** |
| FROM_EMAIL | SPLICE <contact@splice-agency.com> | non |
| TO_EMAIL | contact@splice-agency.com | non |
| AIRTABLE_TOKEN | pat_xxx | **oui** (optionnel) |
| AIRTABLE_BASE | appXXXX | non (optionnel) |
| AIRTABLE_TABLE | Leads | non (optionnel) |

## Étapes (une fois les accès fournis)

1. Déployer `lead-worker.js` sur Cloudflare Workers.
2. Définir les variables ci-dessus.
3. Récupérer l'URL du Worker (ex. `https://lead.splice.workers.dev`).
4. Renseigner cette URL dans `index.html` : `const ENDPOINT = "…";`
5. Tester un envoi de bout en bout.

Tant que `ENDPOINT` est vide dans `index.html`, le formulaire bascule sur un email
pré-rempli (`mailto:`) : aucun faux message « Reçu » n'est jamais affiché.

## RGPD

La case de consentement couvre uniquement la **demande de contact** (recontact au sujet
de la demande), distincte d'un opt-in marketing. Pas de double opt-in imposé.
Prévoir une courte page/politique de confidentialité à lier depuis le formulaire.
