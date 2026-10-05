# Section « Le vrai frein » — retirée de l'accueil

Retirée le 05/10/2026 à la demande de Hugo (« j'aime pas »). Rien n'a été
détruit : tout est ici, mot pour mot. Ce dossier n'est jamais publié
(exclu dans `_config.yml`).

C'était la première section de `<main>` sur `index.html` : le titre
« Un restaurant peut être excellent et pourtant sous-performer. », quatre
cartes de freins, et la chute « Notre travail commence là où se trouve
réellement le frein. »

## Pour la remettre

1. `section.html` → recoller juste après `<main id="main" tabindex="-1">`,
   suivi d'une ligne vide, de `  <hr class="divider">` et d'une ligne vide,
   avant `<!-- AUTONOMIE -->`.
2. `styles.css` → recoller dans le `<style>` principal, juste avant
   `/* ====== AUTONOMIE / bandes centrées ====== */`.
3. Dans la media query `@media(max-width:900px)`, remettre `.frein-list,`
   en tête du sélecteur `.dim-grid,.steps,.founders,.proof-grid{grid-template-columns:1fr}`.

Aucun lien interne ne pointait vers `#frein` et aucun script n'en dépendait :
la remise en place n'a pas d'autre effet de bord.

L'historique git la contient aussi, dans le commit qui précède son retrait.
