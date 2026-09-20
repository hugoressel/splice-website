# Contenu « aides à la digitalisation » (SME Packages) — masqué

Masqué le 20/09/2026. SPLICE ne peut pas être prestataire SME Packages avant
d'avoir un an d'existence. À réévaluer à l'automne 2027 après confirmation par
la House of Entrepreneurship.

Rien n'a été supprimé. Ce dossier contient le contenu retiré, mot pour mot.
Il n'est **jamais publié** (exclu dans `_config.yml`).

## Pour réactiver

1. Dans `config/site-flags.js`, passer le drapeau à `true` :

   ```js
   export const SHOW_SME_PACKAGES = true;
   ```

2. Appliquer, puis pousser :

   ```sh
   node scripts/sme-packages.mjs
   git add -A && git commit -m "Réaffichage des aides à la digitalisation" && git push
   ```

La restauration a été testée : elle rend `index.html`, `aides.html` et
`sitemap.xml` identiques à leur version d'origine, octet pour octet.

## Contenu archivé

| Fichier | Origine |
|---|---|
| `aides.html` | la page dédiée complète (title, meta, JSON-LD FAQPage, contenu) |
| `index-section.html` | la section `#aides` de l'accueil et son séparateur |
| `index-styles.css` | les règles CSS `.aides` de l'accueil |
| `footer-link.txt` | le lien « Aides » du pied de page de l'accueil |
| `sitemap-entry.xml` | l'entrée `<url>` de `aides.html` |
| `sitemap-anchor.txt` | repère de position pour réinsérer l'entrée au bon endroit |

Pendant le masquage, l'URL `/aides.html` n'est pas en 404 : elle sert une
redirection immédiate vers `/#leviers` (meta-refresh + `noindex` + canonical
vers l'accueil). GitHub Pages ne permet pas de renvoyer un vrai code 301 sur
un chemin statique.
