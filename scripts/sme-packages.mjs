#!/usr/bin/env node
/**
 * Bascule l'affichage public du contenu « aides à la digitalisation » (SME Packages).
 *
 *   node scripts/sme-packages.mjs          applique l'état de config/site-flags.js
 *   node scripts/sme-packages.mjs off      masque (archive puis retire des fichiers servis)
 *   node scripts/sme-packages.mjs on       réaffiche (restaure depuis _masked/)
 *   node scripts/sme-packages.mjs status   affiche l'état courant sans rien modifier
 *
 * Principe : le contenu n'est jamais supprimé. Il est archivé mot pour mot dans
 * _masked/sme-packages/ (dossier exclu de la publication) et réinséré à l'identique
 * à sa place d'origine. Rien n'est laissé dans le HTML servi : ni balise cachée,
 * ni display:none, ni commentaire résiduel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = path.join(ROOT, '_masked', 'sme-packages');
const at = (...a) => path.join(ROOT, ...a);
const vault = f => path.join(VAULT, f);
const read = f => fs.readFileSync(f, 'utf8');
const write = (f, s) => fs.writeFileSync(f, s, 'utf8');
const exists = f => fs.existsSync(f);

/* ---------- Définition des blocs ---------- */

// Bloc CSS de la section #aides dans index.html
const CSS = {
  file: 'index.html',
  vaultFile: 'index-styles.css',
  anchor: '/* ====== STORY (Pourquoi SPLICE) ====== */',
  startsAt: l => l.startsWith('.aides .inner{'),
  endsAt: l => l.startsWith('.aides .disclaimer{'),
};

// Section #aides dans index.html (commentaire + section + séparateur suivant)
const SECTION = {
  file: 'index.html',
  vaultFile: 'index-section.html',
  anchor: '  <!-- CONTACT -->',
  startsAt: l => l.includes('<!-- AIDES À LA DIGITALISATION'),
  endsAt: l => l.trim() === '<hr class="divider">',
};

// Lien « Aides » du pied de page de index.html
const FOOTER_LINK = ' · <a href="aides.html">Aides</a>';
const FOOTER_NEEDLE = ' · <a href="confidentialite.html">';

// Page dédiée, remplacée par une redirection douce vers la section des pôles
const PAGE = 'aides.html';
const REDIRECT_STUB = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SPLICE · Nos pôles</title>
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=/#leviers">
<link rel="canonical" href="https://splice-agency.com/">
<script>location.replace('/#leviers');</script>
</head>
<body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#0B0A08;color:#F3EEE4;text-align:center;padding:48px 24px">
<p>Redirection vers nos pôles…</p>
<p><a href="/#leviers" style="color:#C8A96E">Voir nos pôles</a></p>
</body>
</html>
`;

/* ---------- Utilitaires ligne à ligne ---------- */

function cutBlock(text, def) {
  const lines = text.split('\n');
  const s = lines.findIndex(def.startsAt);
  if (s === -1) return null;
  let e = s;
  while (e < lines.length && !def.endsAt(lines[e])) e++;
  if (e >= lines.length) return null;
  if (lines[e + 1] === '') e++; // emporte la ligne vide qui suit
  const block = lines.slice(s, e + 1).join('\n') + '\n';
  const rest = lines.slice(0, s).concat(lines.slice(e + 1)).join('\n');
  return { block, rest };
}

function insertBefore(text, anchor, block) {
  const i = text.indexOf(anchor);
  if (i === -1) throw new Error(`Ancre introuvable : ${anchor}`);
  return text.slice(0, i) + block + text.slice(i);
}

function cutSitemapEntry(xml) {
  const lines = xml.split('\n');
  const hit = lines.findIndex(l => l.includes('aides.html'));
  if (hit === -1) return null;
  let s = hit; while (s >= 0 && !lines[s].includes('<url>')) s--;
  let e = hit; while (e < lines.length && !lines[e].includes('</url>')) e++;
  const block = lines.slice(s, e + 1).join('\n') + '\n';
  const after = lines.slice(e + 1);
  // mémorise l'URL qui suivait, pour restaurer l'entrée à sa place exacte
  const nextLoc = (after.find(l => l.includes('<loc>')) || '').trim();
  const rest = lines.slice(0, s).concat(after).join('\n');
  return { block, rest, nextLoc };
}

function insertSitemapEntry(xml, block, nextLoc) {
  if (nextLoc) {
    const lines = xml.split('\n');
    const i = lines.findIndex(l => l.trim() === nextLoc);
    if (i !== -1) {
      let s = i; while (s >= 0 && !lines[s].includes('<url>')) s--;
      if (s >= 0) {
        lines.splice(s, 0, block.replace(/\n$/, ''));
        return lines.join('\n');
      }
    }
  }
  return insertBefore(xml, '</urlset>', block);
}

/* ---------- Masquage ---------- */

function hide() {
  fs.mkdirSync(VAULT, { recursive: true });
  const done = [];

  // 1. Page dédiée -> archive + redirection
  const pageFile = at(PAGE);
  if (exists(pageFile)) {
    const cur = read(pageFile);
    if (!cur.includes('location.replace')) {
      write(vault('aides.html'), cur);
      write(pageFile, REDIRECT_STUB);
      done.push(`${PAGE} archivé puis remplacé par une redirection vers /#leviers`);
    }
  }

  // 2. index.html : CSS + section + lien de pied de page
  let html = read(at('index.html'));
  for (const def of [CSS, SECTION]) {
    const cut = cutBlock(html, def);
    if (cut) {
      write(vault(def.vaultFile), cut.block);
      html = cut.rest;
      done.push(`index.html : bloc « ${def.vaultFile} » archivé puis retiré`);
    }
  }
  if (html.includes(FOOTER_LINK)) {
    write(vault('footer-link.txt'), FOOTER_LINK + '\n');
    html = html.replace(FOOTER_LINK, '');
    done.push('index.html : lien « Aides » retiré du pied de page');
  }
  write(at('index.html'), html);

  // 3. sitemap.xml
  const sm = cutSitemapEntry(read(at('sitemap.xml')));
  if (sm) {
    write(vault('sitemap-entry.xml'), sm.block);
    write(vault('sitemap-anchor.txt'), sm.nextLoc + '\n');
    write(at('sitemap.xml'), sm.rest);
    done.push('sitemap.xml : entrée aides.html retirée');
  }

  return done;
}

/* ---------- Réaffichage ---------- */

function show() {
  const done = [];
  if (!exists(VAULT)) throw new Error('Aucune archive dans _masked/sme-packages/');

  if (exists(vault('aides.html'))) {
    write(at(PAGE), read(vault('aides.html')));
    done.push(`${PAGE} restauré depuis l'archive`);
  }

  let html = read(at('index.html'));
  for (const def of [CSS, SECTION]) {
    const v = vault(def.vaultFile);
    if (exists(v) && !def.startsAt(html.split('\n').find(def.startsAt) ?? '')) {
      html = insertBefore(html, def.anchor, read(v));
      done.push(`index.html : bloc « ${def.vaultFile} » réinséré`);
    }
  }
  if (exists(vault('footer-link.txt')) && !html.includes(FOOTER_LINK)) {
    html = html.replace(FOOTER_NEEDLE, FOOTER_LINK + FOOTER_NEEDLE);
    done.push('index.html : lien « Aides » réinséré dans le pied de page');
  }
  write(at('index.html'), html);

  const smFile = vault('sitemap-entry.xml');
  if (exists(smFile)) {
    let xml = read(at('sitemap.xml'));
    if (!xml.includes('aides.html')) {
      const anchorFile = vault('sitemap-anchor.txt');
      const nextLoc = exists(anchorFile) ? read(anchorFile).trim() : '';
      xml = insertSitemapEntry(xml, read(smFile), nextLoc);
      write(at('sitemap.xml'), xml);
      done.push('sitemap.xml : entrée aides.html réinsérée à sa place');
    }
  }
  return done;
}

/* ---------- Entrée ---------- */

function currentlyVisible() {
  return read(at('index.html')).includes(FOOTER_LINK);
}

const arg = (process.argv[2] || '').toLowerCase();
let target;
if (arg === 'on') target = true;
else if (arg === 'off') target = false;
else if (arg === 'status') {
  console.log(`Contenu SME Packages actuellement ${currentlyVisible() ? 'VISIBLE' : 'MASQUÉ'}`);
  process.exit(0);
} else {
  ({ SHOW_SME_PACKAGES: target } = await import('../config/site-flags.js'));
  console.log(`config/site-flags.js : SHOW_SME_PACKAGES = ${target}`);
}

const actions = target ? show() : hide();
if (actions.length === 0) {
  console.log(`Rien à faire, le contenu est déjà ${target ? 'visible' : 'masqué'}.`);
} else {
  console.log(target ? 'Réaffichage :' : 'Masquage :');
  for (const a of actions) console.log('  · ' + a);
}
