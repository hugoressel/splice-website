/**
 * SPLICE — Worker de réception des leads (Cloudflare Workers).
 *
 * Architecture pérenne demandée :
 *   Frontend (index.html)  ->  POST JSON  ->  ce Worker
 *     -> notification email (Resend)
 *     -> confirmation email au prospect (Resend)
 *     -> stockage structuré du lead (Airtable = embryon de CRM)
 *     -> réponse 200 JSON  ->  le frontend n'affiche "Reçu" QUE sur 200
 *
 * AUCUN SECRET N'EST ÉCRIT DANS CE FICHIER.
 * Toutes les clés sont lues depuis les variables d'environnement du Worker
 * (Cloudflare > Settings > Variables and Secrets), jamais commitées.
 *
 * Variables/secrets attendus :
 *   ALLOWED_ORIGIN     = https://splice-agency.com
 *   RESEND_API_KEY     = (secret) clé API Resend
 *   FROM_EMAIL         = ex. "SPLICE <contact@splice-agency.com>" (domaine vérifié Resend)
 *   TO_EMAIL           = contact@splice-agency.com
 *   AIRTABLE_TOKEN     = (secret) token Airtable  [optionnel]
 *   AIRTABLE_BASE      = ex. appXXXXXXXX          [optionnel]
 *   AIRTABLE_TABLE     = ex. "Leads"             [optionnel]
 *
 * Une fois déployé, renseigner l'URL du Worker dans index.html :
 *   const ENDPOINT = "https://lead.<votre-sous-domaine>.workers.dev";
 */

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || "https://splice-agency.com";
    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

    let data;
    try { data = await request.json(); } catch { return json({ error: "bad_json" }, 400, cors); }

    // Anti-spam : honeypot rempli => on répond 200 sans rien traiter.
    if (data._gotcha) return json({ ok: true }, 200, cors);

    // Validation minimale côté serveur.
    const nom = str(data.nom), email = str(data.email), etab = str(data.etablissement);
    if (!nom || !email || !etab || !email.includes("@")) {
      return json({ error: "missing_fields" }, 422, cors);
    }
    const lead = {
      nom, email, etablissement: etab,
      telephone: str(data.telephone),
      enjeu: str(data.enjeu),
      message: str(data.message),
      consent: !!data.consent,          // demande de contact, distincte d'un opt-in marketing
      recu_le: new Date().toISOString(),
    };

    // 1) Notification interne + confirmation prospect (Resend).
    if (env.RESEND_API_KEY && env.FROM_EMAIL && env.TO_EMAIL) {
      const summary = Object.entries({
        Nom: lead.nom, Établissement: lead.etablissement, Email: lead.email,
        Téléphone: lead.telephone, Enjeu: lead.enjeu, Message: lead.message,
      }).map(([k, v]) => `${k} : ${v || "-"}`).join("\n");

      await sendEmail(env, {
        to: env.TO_EMAIL,
        subject: `Nouveau diagnostic — ${lead.etablissement}`,
        text: summary,
        reply_to: lead.email,
      });
      await sendEmail(env, {
        to: lead.email,
        subject: "SPLICE — on a bien reçu votre demande",
        text: `Bonjour ${lead.nom},\n\nMerci, on a bien reçu votre demande de diagnostic pour ${lead.etablissement}. On revient vers vous sous 24h.\n\nL'équipe SPLICE\ncontact@splice-agency.com`,
      });
    }

    // 2) Stockage structuré (Airtable) — optionnel, futur CRM.
    if (env.AIRTABLE_TOKEN && env.AIRTABLE_BASE && env.AIRTABLE_TABLE) {
      await fetch(`https://api.airtable.com/v0/${env.AIRTABLE_BASE}/${encodeURIComponent(env.AIRTABLE_TABLE)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: lead }),
      }).catch(() => {});
    }

    return json({ ok: true }, 200, cors);
  },
};

function str(v) { return (v == null ? "" : String(v)).slice(0, 2000).trim(); }
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors } });
}
async function sendEmail(env, { to, subject, text, reply_to }) {
  const body = { from: env.FROM_EMAIL, to: [to], subject, text };
  if (reply_to) body.reply_to = reply_to;
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}
