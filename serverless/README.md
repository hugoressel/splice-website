# Backend leads SPLICE

Formulaire → **Cloudflare Worker** (`splice-lead`) → **Resend** (emails) → réponse 200 → « Reçu ».
Aucun secret dans le repo : tout passe par les variables/secrets du Worker.

## Architecture email (validée)

- **Réception humaine** : `contact@splice-agency.com` (boîte Hostinger existante, inchangée).
- **Envoi automatique** : `notifications@splice-agency.com` (identité d'expédition Resend, pas besoin de boîte).
- Notification interne → `Reply-To = email du prospect` (répondre = écrire au prospect).
- Confirmation prospect → `Reply-To = contact@splice-agency.com`.

## Sécurité DNS (Hostinger préservé)

Resend utilise le sous-domaine `send.` (MX + SPF) et `resend._domainkey` (DKIM), **séparés**
des enregistrements Hostinger racine (MX `mx1/mx2.hostinger.com`, SPF Hostinger, DKIM
`hostingermail-a._domainkey`). **Ne pas toucher** aux MX/SPF/DKIM racine.
Un **DMARC existe déjà** (`p=none`) : **ne pas ajouter** le DMARC proposé par Resend.

## Variables du Worker (Settings > Variables and Secrets)

| Nom | Type | Valeur |
|-----|------|--------|
| ALLOWED_ORIGIN | Text | `https://splice-agency.com` |
| FROM_EMAIL | Text | `SPLICE <notifications@splice-agency.com>` |
| TO_EMAIL | Text | `contact@splice-agency.com` |
| REPLY_TO | Text (optionnel) | `contact@splice-agency.com` |
| RESEND_API_KEY | **Secret (Encrypt)** | `re_…` |

Rate limiting optionnel : lier un namespace KV nommé `RL` au Worker (limite 5 req/h/IP).

## Mise en service

1. Resend : compte → domaine `splice-agency.com` (région UE) → DNS (`send` + `resend._domainkey`, **pas** de DMARC) → Verify → clé API.
2. Cloudflare : compte → Worker `splice-lead` → coller `lead-worker.js` → Deploy → variables + secret.
3. Récupérer l'URL du Worker → la renseigner dans `index.html` : `const ENDPOINT = "…";`
4. Tester de bout en bout.

Tant que `ENDPOINT` est vide, le formulaire bascule sur un email pré-rempli (`mailto:`) :
aucun faux « Reçu » n'est jamais affiché.

## RGPD

Consentement limité au traitement de la demande de contact (pas de double opt-in, pas de newsletter).
Voir la future page `/confidentialite` (texte à valider).

## Extension CRM (plus tard)

Point d'entrée unique `storeLead()` dans `lead-worker.js` (aujourd'hui no-op).
Y brancher Airtable / Supabase / HubSpot sans toucher au reste.
