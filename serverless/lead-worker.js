/**
 * SPLICE — Worker de réception des leads (Cloudflare Workers).
 *
 * Flux :
 *   Formulaire (index.html) -> POST JSON -> ce Worker
 *     -> validation serveur + honeypot + anti-spam
 *     -> email interne à SPLICE (Reply-To = prospect)
 *     -> email de confirmation au prospect (Reply-To = contact@)
 *     -> réponse 200 JSON  ->  le front n'affiche "Reçu" QUE sur 200
 *
 * AUCUN SECRET DANS CE FICHIER. Tout vient des variables/secrets du Worker.
 *
 * Variables (Settings > Variables and Secrets) :
 *   ALLOWED_ORIGIN = https://splice-agency.com        (Text)
 *   FROM_EMAIL     = SPLICE <notifications@splice-agency.com>   (Text)
 *   TO_EMAIL       = contact@splice-agency.com         (Text)
 *   REPLY_TO       = contact@splice-agency.com         (Text, optionnel — défaut = TO_EMAIL)
 *   RESEND_API_KEY = re_...                             (Secret / Encrypt)
 *
 * Rate limiting (optionnel) : créer un namespace KV et le lier au Worker
 *   sous le nom "RL" pour activer une limite simple par IP. Sinon ignoré.
 *
 * CRM (plus tard) : la fonction storeLead() est le point d'extension unique
 *   (Airtable / Supabase / HubSpot). Laissée volontairement inactive.
 */

const MAX = { nom: 120, etablissement: 160, email: 200, telephone: 40, enjeu: 120, message: 2000, source: 300 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CTRL_RE = new RegExp("[\\u0000-\\u001F\\u007F]+", "g");

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGIN || "https://splice-agency.com")
      .split(",").map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const allowOrigin = allowed.includes(origin) ? origin : allowed[0];
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

    // Refuse les requêtes navigateur d'origines non autorisées.
    if (origin && !allowed.includes(origin)) return json({ error: "forbidden_origin" }, 403, cors);

    let raw;
    try { raw = await request.json(); } catch { return json({ error: "bad_json" }, 400, cors); }

    // Honeypot : rempli => bot. On répond 200 sans rien traiter.
    if (clean(raw._gotcha)) return json({ ok: true }, 200, cors);

    // Rate limiting simple par IP (si un KV "RL" est lié au Worker).
    if (env.RL) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const key = "rl:" + ip;
      const hits = parseInt((await env.RL.get(key)) || "0", 10);
      if (hits >= 5) return json({ error: "rate_limited" }, 429, cors);
      await env.RL.put(key, String(hits + 1), { expirationTtl: 3600 });
    }

    // Normalisation + validation serveur.
    const lead = {
      nom: clean(raw.nom, MAX.nom),
      etablissement: clean(raw.etablissement, MAX.etablissement),
      email: clean(raw.email, MAX.email).toLowerCase(),
      telephone: clean(raw.telephone, MAX.telephone),
      enjeu: clean(raw.enjeu, MAX.enjeu),
      message: clean(raw.message, MAX.message),
      source: clean(raw.source, MAX.source),
      consent: raw.consent === true || raw.consent === "true" || raw.consent === "on",
      recu_le: new Date().toISOString(),
    };
    if (!lead.nom || !lead.etablissement || !lead.email || !lead.telephone || !lead.enjeu) {
      return json({ error: "missing_fields" }, 422, cors);
    }
    if (!EMAIL_RE.test(lead.email)) return json({ error: "invalid_email" }, 422, cors);

    // Vérif config email.
    if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.TO_EMAIL) {
      return json({ error: "server_misconfigured" }, 500, cors);
    }
    const replyToContact = env.REPLY_TO || env.TO_EMAIL;

    // 1) Notification interne (Reply-To = prospect => "Répondre" écrit au prospect).
    const notif = await sendEmail(env, {
      to: env.TO_EMAIL,
      reply_to: lead.email,
      subject: `Nouvelle demande de diagnostic — ${lead.etablissement || lead.nom}`,
      text: internalText(lead),
    });
    if (!notif.ok) return json({ error: "send_failed" }, 502, cors);

    // 2) Confirmation prospect (Reply-To = contact@). Non bloquant si échec.
    await sendEmail(env, {
      to: lead.email,
      reply_to: replyToContact,
      subject: "Votre demande a bien été reçue — SPLICE",
      text: prospectText(lead),
    });

    // 3) Point d'extension CRM (désactivé pour l'instant).
    await storeLead(env, lead);

    return json({ ok: true }, 200, cors);
  },
};

/* ---------- helpers ---------- */

function clean(v, max) {
  let s = v == null ? "" : String(v);
  s = s.replace(CTRL_RE, " ").replace(/\s+/g, " ").trim();
  if (max) s = s.slice(0, max);
  return s;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors },
  });
}

function internalText(l) {
  return [
    `Nom            : ${l.nom}`,
    `Établissement  : ${l.etablissement}`,
    `Email          : ${l.email}`,
    `Téléphone      : ${l.telephone}`,
    `Enjeu principal: ${l.enjeu}`,
    `Message        : ${l.message || "-"}`,
    `Date/heure     : ${l.recu_le}`,
    `Page d'origine : ${l.source || "-"}`,
    `Consentement   : ${l.consent ? "oui" : "non"}`,
  ].join("\n");
}

function prospectText(l) {
  const prenom = (l.nom || "").split(" ")[0] || "";
  return [
    `Bonjour ${prenom},`,
    ``,
    `Merci, nous avons bien reçu votre demande de diagnostic pour ${l.etablissement}.`,
    `Hugo ou Dylan revient vers vous rapidement pour faire le point sur votre établissement`,
    `et identifier les premiers leviers à activer.`,
    ``,
    `À très vite,`,
    `SPLICE — Partenaire de croissance des restaurateurs · Luxembourg`,
    `contact@splice-agency.com`,
  ].join("\n");
}

async function sendEmail(env, { to, subject, text, reply_to }) {
  const body = { from: env.FROM_EMAIL, to: [to], subject, text };
  if (reply_to) body.reply_to = reply_to;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: r.ok };
  } catch {
    return { ok: false };
  }
}

/**
 * Point d'extension CRM unique. Aujourd'hui : no-op.
 * Demain : brancher Airtable / Supabase / HubSpot ici sans toucher au reste.
 */
async function storeLead(env, lead) {
  return; // désactivé volontairement
}
