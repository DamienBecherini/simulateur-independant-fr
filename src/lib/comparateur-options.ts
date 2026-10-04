// src/lib/comparateur-options.ts

import type { ComparaisonOptions, Company, FraisFonctionnement, MicroEntreprise, PosteFrais, SessionState, StatutFrais } from "@/types"

/** Libellés des postes de frais, dans l'ordre d'affichage. */
export const posteFraisLabels: Record<PosteFrais, string> = {
  expertComptable: "Expert-comptable",
  banque: "Compte bancaire professionnel",
  logiciel: "Logiciel de facturation et de comptabilité",
  assurance: "Assurance responsabilité civile professionnelle",
  cfe: "Cotisation foncière des entreprises (CFE)"
}

export const statutsFrais: StatutFrais[] = ["SASU", "EURL", "EI", "micro"]

/**
 * Frais de fonctionnement annuels proposés par défaut : des ordres de grandeur, à ajuster à sa situation.
 * Le recours à un expert-comptable n'est pas obligatoire, mais quasi systématique en société (bilan, liasse fiscale).
 * La CFE varie selon la commune, et n'est pas due l'année de création.
 */
export function defaultFraisFonctionnement(): FraisFonctionnement {
  return {
    SASU: { expertComptable: 2000, banque: 200, logiciel: 150, assurance: 250, cfe: 300 },
    EURL: { expertComptable: 2000, banque: 200, logiciel: 150, assurance: 250, cfe: 300 },
    EI: { expertComptable: 1200, banque: 150, logiciel: 150, assurance: 250, cfe: 300 },
    micro: { expertComptable: 0, banque: 100, logiciel: 100, assurance: 250, cfe: 300 }
  }
}

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
    partBncPrestations: 1,
    fraisFonctionnement: defaultFraisFonctionnement()
  }
}
