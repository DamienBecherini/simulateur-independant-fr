// ui/utils/formatters.js
export const formatCurrency = value => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0)

export function createTooltip(text, tooltipKey) {
  return `<span class="tooltip" data-tooltip-key="${tooltipKey}">${text}<span class="tooltip-text"></span></span>`
}
