// src/lib/comparateur-options.ts

import type { ComparaisonOptions, Company, FraisFonctionnement, MicroEntreprise, ModeRepartition, PosteFrais, DonneesDeLAnnee, StatutFrais } from "@/types"

/** Libellés des postes de frais, dans l'ordre d'affichage. */
export const posteFraisLabels: Record<PosteFrais, string> = {
  expertComptable: "Expert-comptable",
  banque: "Compte bancaire professionnel",
  logiciel: "Logiciel de facturation et de comptabilité",
  assurance: "Assurance responsabilité civile professionnelle",
  cfe: "Cotisation foncière des entreprises (CFE)"
}

export const statutsFrais: StatutFrais[] = ["SASU", "EURL", "EI", "micro"]

/** Modes de partage du bénéfice en SASU et EURL, dans l'ordre d'affichage, avec leur libellé. */
export const libellesRepartition: Record<ModeRepartition, string> = {
  dividendes: "Rémunération saisie, le reste en dividendes",
  remuneration: "Tout en rémunération",
  personnalisee: "Répartition personnalisée",
  grille: "Dividendes saisis dans la grille"
}

/**
 * Reporte une rémunération dans le comparateur, tout le bénéfice restant étant distribué : en répartition
 * personnalisée, on y reste, avec 100 % distribué ; sinon, on passe à « le reste en dividendes ».
 */
export function avecRemuneration(options: ComparaisonOptions, remunerationNette: number): ComparaisonOptions {
  const mode = options.repartition.mode === "personnalisee" ? "personnalisee" : "dividendes"
  return { ...options, remunerationNette, repartition: { mode, partDistribuee: 1 } }
}

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
    micro: { expertComptable: 0, banque: 100, logiciel: 100, assurance: 350, cfe: 300 }
  }
}

/** Activités qu'on peut faire changer de statut dans le comparateur. */
export function comparableActivities(session: DonneesDeLAnnee): (Company | MicroEntreprise)[] {
  return session.entities.filter((e): e is Company | MicroEntreprise => e.type !== "person")
}

/**
 * Réglages proposés à l'ouverture du comparateur pour une activité : on reprend la rémunération et les
 * dividendes saisis ; sans dividendes saisis, tout le bénéfice disponible est distribué, pour ne pas
 * pénaliser les statuts en société avec un bénéfice qui resterait bloqué.
 */
export function defaultComparisonOptions(session: DonneesDeLAnnee, activityId: string): ComparaisonOptions {
  const flows = session.monthlyData.flatMap(month => month.flows).filter(flow => flow.entityId === activityId)
  const annualTotal = (type: string) => flows.filter(flow => flow.type === type).reduce((sum, flow) => sum + flow.amount, 0)

  return {
    activityId,
    remunerationNette: annualTotal("director_remuneration"),
    repartition: { mode: annualTotal("dividends_payment") === 0 ? "dividendes" : "grille", partDistribuee: 1 },
    partBncPrestations: 1,
    fraisFonctionnement: defaultFraisFonctionnement()
  }
}
