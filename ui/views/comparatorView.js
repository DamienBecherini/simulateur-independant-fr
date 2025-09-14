// ui/views/comparatorView.js
import { formatCurrency } from "../utils/formatters.js"

export function displayComparatorView(results, container) {
  // On ajoute le div .table-container ici
  const tableHTML = `
    <h2>Tableau Comparatif Synthétique</h2>
    <div class="table-container">
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
                  <td class="statut">${res.statut}${res.warning ? `<span class="warning-tooltip" title="${res.warning}">⚠️</span>` : ""}</td>
                  <td>${formatCurrency(res.revenuImposable)}</td>
                  <td>${res.statutTVA}</td>
                  <td class="statut ${res.warning ? "invalid-result" : ""}">${formatCurrency(res.netDansLaPoche)}</td>
                </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`
  container.innerHTML = tableHTML
}
