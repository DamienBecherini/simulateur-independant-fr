// ui/views/statusDetailView.js
import { formatCurrency } from "../utils/formatters.js"

// --- Fonctions de rendu des tableaux de synthèse ---

function renderMicroTable(res, config) {
  // Accepte 'config' en paramètre
  // Cas spécial : si un avertissement existe, on appelle la fonction centralisée
  if (res.warning) {
    return generateWarningContentHTML(res, config, false) // Appel centralisé
  }

  // Cas normal : le tableau de synthèse
  return `
    <div class="table-container">
      <table class="details-summary-table">
        <thead><tr><th colspan="2">Synthèse Micro-Entreprise</th></tr></thead>
        <tbody>
          <tr><td>Chiffre d'Affaires</td><td>${formatCurrency(res.chiffreAffaires)}</td></tr>
          <tr><td>(-) Cotisations Sociales (${((res.cotisationsSociales / res.chiffreAffaires) * 100).toFixed(1)}%)</td><td>${formatCurrency(-res.cotisationsSociales)}</td></tr>
          <tr><td><strong>Revenu Net de cotisations</strong></td><td><strong>${formatCurrency(res.revenuNetApresCotisations)}</strong></td></tr>
          <tr><td>Revenu Imposable (après abattement)</td><td>${formatCurrency(res.revenuImposable)}</td></tr>
          <tr><td>(-) Surcoût Impôt sur le Revenu</td><td>${formatCurrency(-res.surcoutIR)}</td></tr>
          <tr><td>(-) Charges pro. (pour info, non déduites)</td><td>${formatCurrency(-res.chargesReelles)}</td></tr>
          <tr class="final-result"><td ><strong>= Net dans la poche final</strong></td><td><strong>${formatCurrency(res.netDansLaPoche)}</strong></td></tr>
        </tbody>
      </table>
    </div>`
}

function renderEITable(res) {
  return `
    <div class="table-container">
      <table class="details-summary-table">
        <thead><tr><th colspan="2">Synthèse EI (Régime Réel)</th></tr></thead>
        <tbody>
          <tr><td>Chiffre d'Affaires</td><td>${formatCurrency(res.chiffreAffaires)}</td></tr>
          <tr><td>(-) Charges Professionnelles</td><td>${formatCurrency(-res.chargesReelles)}</td></tr>
          <tr><td><strong>= Bénéfice Réel (Base de calcul)</strong></td><td><strong>${formatCurrency(res.revenuImposable)}</strong></td></tr>
          <tr><td>(-) Cotisations Sociales TNS (~45%)</td><td>${formatCurrency(-res.cotisationsSociales)}</td></tr>
          <tr><td>(-) Surcoût Impôt sur le Revenu</td><td>${formatCurrency(-res.surcoutIR)}</td></tr>
          <tr class="final-result"><td><strong>= Net dans la poche final</strong></td><td><strong>${formatCurrency(res.netDansLaPoche)}</strong></td></tr>
        </tbody>
      </table>
    </div>`
}

function renderSocieteTable(res) {
  const beneficeAvantIS = res.chiffreAffaires - res.chargesReelles - (res.remuneration?.coutTotal || 0)
  const meilleureOption = res.dividendes.pfu.net > res.dividendes.bareme.net ? "pfu" : "bareme"
  const fiscaliteDividendes = meilleureOption === "pfu" ? res.dividendes.pfu.cout : res.dividendes.bareme.cout
  const dividendesNets = meilleureOption === "pfu" ? res.dividendes.pfu.net : res.dividendes.bareme.net

  return `
    <div class="table-container">
      <table class="details-summary-table">
          <thead><tr><th colspan="2">Parcours de l'argent : de l'entreprise à votre poche</th></tr></thead>
          <tbody>
              <tr class="section-header"><td colspan="2">1. Au niveau de la Société</td></tr>
              <tr><td>Chiffre d'Affaires</td><td>${formatCurrency(res.chiffreAffaires)}</td></tr>
              <tr><td>(-) Charges Professionnelles</td><td>${formatCurrency(-res.chargesReelles)}</td></tr>
              <tr><td>(-) Coût total de la rémunération</td><td>${formatCurrency(-res.remuneration.coutTotal)}</td></tr>
              <tr><td><strong>= Bénéfice avant Impôt Société</strong></td><td><strong>${formatCurrency(beneficeAvantIS)}</strong></td></tr>
              <tr><td>(-) Impôt sur les Sociétés (IS)</td><td>${formatCurrency(-res.impotSocietes)}</td></tr>
              <tr><td><strong>= Argent distribuable en dividendes</strong></td><td><strong>${formatCurrency(res.dividendes.bruts)}</strong></td></tr>
              
              <tr class="section-header"><td colspan="2">2. Au niveau du Dirigeant</td></tr>
              <tr><td>(+) Rémunération Nette (avant IR)</td><td>${formatCurrency(res.remuneration.net)}</td></tr>
              <tr><td>(+) Dividendes Bruts</td><td>${formatCurrency(res.dividendes.bruts)}</td></tr>
              <tr><td>(-) Fiscalité sur dividendes (IR + PS)</td><td>${formatCurrency(-fiscaliteDividendes)}</td></tr>
              <tr><td><em>&nbsp;&nbsp;&nbsp;↳ Dividendes Nets (après fiscalité)</em></td><td><em>${formatCurrency(dividendesNets)}</em></td></tr>
              <tr><td>(-) Surcoût d'IR sur la rémunération</td><td>${formatCurrency(-res.surcoutIR)}</td></tr>

              <tr class="section-header"><td colspan="2">3. Résultat Final</td></tr>
              <tr class="final-result"><td><strong>= Net dans la poche total</strong></td><td><strong>${formatCurrency(res.netDansLaPoche)}</strong></td></tr>
          </tbody>
      </table>
    </div>`
}

// --- Fonction d'initialisation (inchangée) ---

export async function initializeStatusTabs(content, panes) {
  for (const statusName in panes) {
    const pane = panes[statusName]
    const guideKey = statusName
      .toLowerCase()
      .replace(/ \(.+\)/, "")
      .replace(" ", "-")

    const guideMarkdown = content.guides[guideKey] || `<em>Guide pour "${statusName}" non disponible.</em>`
    const guideHTML = await window.api.toHtml(guideMarkdown)

    pane.innerHTML = `
      <div class="status-detail-view">
        <div class="main-content" id="results-placeholder-${guideKey}">
          <div class="placeholder-text">
            <p>Les résultats de la simulation pour ce statut s'afficheront ici.</p>
          </div>
        </div>
        <div class="guide-section">
          ${guideHTML}
        </div>
      </div>
    `
  }
}

// --- Fonction d'affichage (MISE À JOUR) ---
// Elle accepte maintenant 'config' pour le passer à renderMicroTable
export function displayStatusDetailView(res, container, config) {
  let summaryTableHTML = ""

  switch (res.statut) {
    case "Micro-Entreprise":
      summaryTableHTML = renderMicroTable(res, config) // On passe config
      break
    case "EI (Régime Réel)":
      summaryTableHTML = renderEITable(res)
      break
    case "SASU (IS)":
    case "EURL (IS)":
      summaryTableHTML = renderSocieteTable(res)
      break
  }

  container.innerHTML = summaryTableHTML
}

// --- Fonction d'attache des tooltips (inchangée) ---
export function attachTooltips(tooltipsData) {
  document.querySelectorAll(".tooltip").forEach(el => {
    const key = el.getAttribute("data-tooltip-key")
    if (tooltipsData[key]) {
      const tooltipTextNode = el.querySelector(".tooltip-text")
      if (tooltipTextNode) {
        tooltipTextNode.textContent = tooltipsData[key]
      }
    }
  })
}

// --- Fonction de génération de l'avertissement (MISE À JOUR) ---
// C'est maintenant la SEULE source pour le HTML de l'avertissement.
export function generateWarningContentHTML(res, config, options = {}) {
  // Définir l'état par défaut de l'accordéon
  const { accordionOpen = false } = options
  const openAttribute = accordionOpen ? "open" : ""

  if (!res.warning) return ""

  if (res.warning.includes("Plafond de")) {
    const plafondService = config.microEntreprise.plafonds.services
    const plafondVente = config.microEntreprise.plafonds.vente

    const plafondAtteint = res.chiffreAffaires > plafondService ? plafondVente : plafondService
    const plafondText = `${plafondAtteint.toLocaleString("fr-FR")} € ${res.chiffreAffaires > plafondService ? "(vente)" : "(services)"}`

    return `
      <div class="warning-block">
        <h3>⚠️ Plafond de ${plafondText} dépassé !</h3>
        <p>Le régime de la micro-entreprise n'est plus applicable à ce niveau de chiffre d'affaires. Les calculs sont donc invalidés.</p>
        <details class="accordion warning-accordion" ${openAttribute}>
          <summary>Que se passe-t-il maintenant ?</summary>
          <div class="accordion-content">
            
            <h4>Implications du dépassement :</h4>
            <div class="implications-list">
              <div class="implication-item">
                <div class="label">Si c'est la première fois :</div>
                <div class="description">Vous conservez le régime micro pour l'année en cours, mais vous devenez assujetti à la TVA dès le premier jour du mois de dépassement.</div>
              </div>
              <div class="implication-item">
                <div class="label">Si vous dépassez 2 années de suite :</div>
                <div class="description">Vous basculez obligatoirement en <strong>Entreprise Individuelle (EI) au régime réel</strong> dès le 1er janvier de l'année suivante.</div>
              </div>
            </div>

            <h4>Que faire ?</h4>
            <p>La simulation pour l'<strong>EI (Régime Réel)</strong> vous donne une estimation fiable de ce que deviendront vos impôts et cotisations. Il est fortement conseillé de vous rapprocher d'un expert-comptable pour anticiper cette transition.</p>

          </div>
        </details>
      </div>`
  }

  // Cas pour tout autre avertissement futur
  return `<p class="warning-message">${res.warning}</p>`
}
