// ui/display.js - VERSION LISIBLE ET QUI GÈRE LES ERREURS

// --- Helper principal pour formater les devises ---
const formatCurrency = value => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0)

// --- Fonctions de rendu pour chaque statut ---

function renderMicroDetails(res) {
  // Cas où le plafond est dépassé : on affiche l'avertissement et RIEN d'autre.
  if (res.warning) {
    return `
      <div>
        <h3>${res.statut}</h3>
        <p class="warning-message">
          <strong>⚠️ ${res.warning}</strong>
        </p>
      </div>
    `
  }

  // Cas normal.
  return `
    <div>
      <h3>${res.statut}</h3>
      <ul>
        <li><span>Chiffre d'Affaires</span> <span>${formatCurrency(res.chiffreAffaires)}</span></li>
        <li><span>(-) Cotisations URSSAF</span> <span>${formatCurrency(-res.cotisationsSociales)}</span></li>
        <li><strong>= Revenu après cotisations</strong> <span><strong>${formatCurrency(res.revenuNetApresCotisations)}</strong></span></li>
        <li><span>(-) Charges réelles estimées</span> <span>${formatCurrency(-res.chargesReelles)}</span></li>
        <li><span>(-) Surcoût Impôt Revenu</span> <span>${formatCurrency(-res.surcoutIR)}</span></li>
        <li><strong>= Total Net dans la poche</strong> <span><strong>${formatCurrency(res.netDansLaPoche)}</strong></span></li>
      </ul>
    </div>
  `
}

function renderEIDetails(res) {
  return `
    <div>
      <h3>${res.statut}</h3>
      <ul>
        <li><span>Chiffre d'Affaires</span> <span>${formatCurrency(res.chiffreAffaires)}</span></li>
        <li><span>(-) Charges réelles</span> <span>${formatCurrency(-res.chargesReelles)}</span></li>
        <li><strong>= Bénéfice (Revenu Imposable)</strong> <span><strong>${formatCurrency(res.revenuImposable)}</strong></span></li>
        <li><span>(-) Cotisations Sociales</span> <span>${formatCurrency(-res.cotisationsSociales)}</span></li>
        <li><span>(-) Surcoût Impôt Revenu</span> <span>${formatCurrency(-res.surcoutIR)}</span></li>
        <li><strong>= Total Net dans la poche</strong> <span><strong>${formatCurrency(res.netDansLaPoche)}</strong></span></li>
      </ul>
    </div>
  `
}

function renderSocieteDetails(res) {
  const hasDividends = res.dividendes && res.dividendes.pfu
  const meilleureOption = hasDividends && res.dividendes.pfu.net > res.dividendes.bareme.net ? "pfu" : "bareme"

  return `
    <div>
      <h3>${res.statut}</h3>
      <ul>
        <li><span>Chiffre d'Affaires</span> <span>${formatCurrency(res.chiffreAffaires)}</span></li>
        <li><span>(-) Charges déductibles</span> <span>${formatCurrency(res.chargesReelles)}</span></li>
      </ul>
      <br>
      <strong>Rémunération du dirigeant</strong>
      <ul>
        <li><span>Net visé</span> <span>${formatCurrency(res.remuneration?.net)}</span></li>
        <li><span>Brut (estimé)</span> <span>${formatCurrency(res.remuneration?.brut)}</span></li>
        <li><span>Total Cotisations</span> <span>${formatCurrency((res.remuneration?.chargesSalariales || 0) + (res.remuneration?.chargesPatronales || 0))}</span></li>
      </ul>
      <br>
      <strong>Résultat de la société</strong>
      <ul>
        <li><span>Bénéfice avant IS</span> <span>${formatCurrency(res.chiffreAffaires - res.chargesReelles - (res.remuneration?.coutTotal || 0))}</span></li>
        <li><span>(-) Impôt sur les Sociétés</span> <span>${formatCurrency(-res.impotSocietes)}</span></li>
        <li><strong>= Dividendes distribuables</strong> <span><strong>${formatCurrency(res.dividendes?.bruts)}</strong></span></li>
      </ul>
      <br>
      ${
        hasDividends && res.dividendes.bruts > 0
          ? `
        <strong>Dividendes (comparaison)</strong>
        <ul>
          <li ${meilleureOption === "pfu" ? 'style="background-color: var(--success-bg-color);"' : ""}>
            <span>Net avec Flat Tax (PFU)</span> <span>${formatCurrency(res.dividendes.pfu.net)}</span>
          </li>
          <li ${meilleureOption === "bareme" ? 'style="background-color: var(--success-bg-color);"' : ""}>
            <span>Net avec Barème IR</span> <span>${formatCurrency(res.dividendes.bareme.net)}</span>
          </li>
        </ul>
        <br>
      `
          : ""
      }
      <ul>
        <li><strong>= Total Net dans la poche</strong> <span><strong>${formatCurrency(res.netDansLaPoche)}</strong></span></li>
      </ul>
    </div>
  `
}

// --- Fonctions Principales (exportées) ---

export function displayResults(results, container) {
  const tableHTML = `
    <h2>Tableau Comparatif Synthétique</h2>
    <table>
      <thead>
        <tr>
          <th>Statut</th>
          <th>Base Imposable (IR)</th>
          <th>Statut TVA</th>
          <th>Total "Net dans la poche"</th>
        </tr>
      </thead>
      <tbody>
        ${results
          .map(
            res => `
          <tr>
            <td class="statut">
              ${res.statut}
              ${res.warning ? `<span class="warning-tooltip" title="${res.warning}">⚠️</span>` : ""}
            </td>
            <td>${formatCurrency(res.revenuImposable)}</td>
            <td>${res.statutTVA}</td>
            <td class="statut ${res.warning ? "invalid-result" : ""}">${formatCurrency(res.netDansLaPoche)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `
  container.innerHTML = tableHTML
}

export function displayDetails(results, container) {
  const detailsHTML = `<div class="details-grid">${results
    .map(res => {
      switch (res.statut) {
        case "Micro-Entreprise":
          return renderMicroDetails(res)
        case "EI (Régime Réel)":
          return renderEIDetails(res)
        case "SASU (IS)":
        case "EURL (IS)":
          return renderSocieteDetails(res)
        default:
          return ""
      }
    })
    .join("")}</div>`
  container.innerHTML = detailsHTML
}

export function generateWarningContentHTML(res, config) {
  if (!res.warning) return "" // Sécurité

  const format = value => value.toLocaleString("fr-FR")

  // CAS 1 : Dépassement du plafond du régime Micro-Fiscal
  if (res.warning.includes("Plafond de")) {
    const plafond = res.statut.includes("services") ? config.microEntreprise.plafonds.services : config.microEntreprise.plafonds.vente
    return `
      <h4>Dépassement du Plafond Micro-Entrepreneur</h4>
      <p>
        Vous avez dépassé le plafond de CA de <strong>${format(plafond)} €</strong>. Voici ce que cela implique :
      </p>
      <ul>
        <li><strong>Tolérance (1ère fois) :</strong> Si c'est la première année que vous dépassez, vous restez micro-entrepreneur pour l'année en cours.</li>
        <li><strong>Sortie du régime (2ème fois) :</strong> Si vous dépassez à nouveau l'année prochaine, vous sortirez du régime micro au 1er janvier de l'année suivante (N+2) et basculerez en <strong>Entreprise Individuelle au Régime Réel</strong>.</li>
      </ul>
      <h4>Que faire ?</h4>
      <ul>
        <li><strong>Anticiper :</strong> La simulation "EI (Régime Réel)" vous montre ce que seront vos impôts et cotisations après la sortie du régime.</li>
        <li><strong>Comptabilité :</strong> Préparez-vous à tenir une comptabilité complète (recettes ET dépenses). L'aide d'un expert-comptable est fortement recommandée.</li>
      </ul>
      <div class="late-notice">
        <strong>Que faire si je m'en rends compte trop tard ?</strong>
        <p>Pas de panique. L'administration fiscale est généralement compréhensive si vous êtes proactif. Contactez votre Service des Impôts des Entreprises (SIE) pour régulariser votre situation. Il est crucial de ne pas attendre un contrôle.</p>
      </div>
    `
  }

  // Ajoutez d'autres `if` ici pour d'autres types d'avertissements (TVA, etc.)

  return `<p>${res.warning}</p>` // Fallback
}
