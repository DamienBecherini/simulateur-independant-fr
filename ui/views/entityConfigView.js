// Fichier : ui/views/entityConfigView.js

function generatePersonForm(entity) {
  const p = entity.properties
  return `
        <form id="entity-config-form" data-entity-id="${entity.id}">
            <div class="form-group">
                <label for="entity-name">Nom</label>
                <input type="text" id="entity-name" name="name" value="${entity.name}" required>
            </div>
            <div class="form-group">
                <label for="parts-fiscales">Parts Fiscales</label>
                <input type="number" id="parts-fiscales" name="partsFiscales" value="${p.partsFiscales}" step="0.5" min="0">
            </div>
            <fieldset>
                <legend>Aide au Retour à l'Emploi (ARE)</legend>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="are-daily-rate">Taux Journalier (€)</label>
                        <input type="number" id="are-daily-rate" name="areDailyRate" value="${p.are?.dailyRate || 0}" min="0">
                    </div>
                    <div class="form-group">
                        <label for="are-remaining-days">Jours d'ARE restants</label>
                        <input type="number" id="are-remaining-days" name="areRemainingDays" value="${p.are?.remainingDays || 0}" min="0">
                    </div>
                </div>
            </fieldset>
            <button type="submit" class="btn-primary">Enregistrer</button>
        </form>
    `
}

function generateCompanyForm(entity) {
  const p = entity.properties
  return `
        <form id="entity-config-form" data-entity-id="${entity.id}">
            <div class="form-group">
                <label for="entity-name">Nom de la société</label>
                <input type="text" id="entity-name" name="name" value="${entity.name}" required>
            </div>
            <div class="form-group">
                <label for="company-status">Statut Juridique</label>
                <select id="company-status" name="status">
                    <option value="SASU" ${p.status === "SASU" ? "selected" : ""}>SASU (IS)</option>
                    <option value="EURL" ${p.status === "EURL" ? "selected" : ""}>EURL (IS)</option>
                </select>
            </div>
            <div class="form-group">
                <label for="capital-social">Capital Social</label>
                <input type="number" id="capital-social" name="capitalSocial" value="${p.capitalSocial}" min="0">
            </div>
            <button type="submit" class="btn-primary">Enregistrer</button>
        </form>
    `
}

export function generateEntityConfigForm(entity) {
  switch (entity.type) {
    case "person":
      return generatePersonForm(entity)
    case "company":
      return generateCompanyForm(entity)
    // case 'micro-enterprise': ... (à faire plus tard)
    default:
      return `<p>Configuration non disponible pour ce type d'entité.</p>`
  }
}
