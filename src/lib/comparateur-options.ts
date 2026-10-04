// src/lib/comparateur-options.ts

import type { ComparaisonOptions, Company, MicroEntreprise, SessionState } from "@/types"

/** Activités qu'on peut faire changer de statut dans le comparateur. */
export function comparableActivities(session: SessionState): (Company | MicroEntreprise)[] {
  return session.entities.filter((e): e is Company | MicroEntreprise => e.type !== "person")
}

/**
 * Réglages proposés à l'ouverture du comparateur pour une activité : on reprend la rémunération et les
 * dividendes saisis ; sans dividendes saisis, tout le bénéfice disponible est distribué, pour ne pas
 * pénaliser les statuts en société avec un bénéfice qui resterait bloqué.
 */
export function defaultComparisonOptions(session: SessionState, activityId: string): ComparaisonOptions {
  const flows = session.monthlyData.flatMap(month => month.flows).filter(flow => flow.entityId === activityId)
  const annualTotal = (type: string) => flows.filter(flow => flow.type === type).reduce((sum, flow) => sum + flow.amount, 0)

  return {
    activityId,
    remunerationNette: annualTotal("director_remuneration"),
    distribuerToutLeBenefice: annualTotal("dividends_payment") === 0,
    partBncPrestations: 1
  }
}
