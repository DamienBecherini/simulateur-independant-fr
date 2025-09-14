// ui/utils/formatters.js
export const formatCurrency = value => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0)

export function createTooltip(text, tooltipKey) {
  return `<span class="tooltip" data-tooltip-key="${tooltipKey}">${text}<span class="tooltip-text"></span></span>`
}

export function formatDate(isoString) {
  if (!isoString) return ""
  const date = new Date(isoString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0") // Les mois sont de 0 à 11
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")

  return `${day}/${month}/${year} à ${hours}:${minutes}`
}
