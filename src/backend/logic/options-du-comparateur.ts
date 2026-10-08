// src/backend/logic/options-du-comparateur.ts
// Réglages du comparateur proposés par défaut, et ceux de l'utilisateur complétés par ces valeurs (voir l'ADR 009).
// Ils vivent avec le moteur pour servir à la fois l'interface (src/lib/comparateur-options.ts) et les outils des
// clients d'IA (src/backend/logic/outils, voir l'ADR 010) : les deux comparent avec les mêmes réglages.

import type { ComparaisonOptions, DonneesDeLAnnee, FraisFonctionnement, ReglagesComparateur, RepartitionBenefice, SimulationAnnuelle } from "../../types.js"

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

/** « Sur toutes les années » : part du bénéfice distribuable gardée chaque année proposée par défaut (voir l'ADR 012). */
export const PART_MISE_EN_RESERVE_PAR_DEFAUT = 0.5

/**
 * Au meilleur net, la case « avec 4 trimestres de retraite » est cochée d'office : une rémunération qui ne valide aucun
 * trimestre est rarement un bon choix sans le savoir. Seul un choix de l'utilisateur est enregistré (ADR 009) : une
 * case décochée le reste, et les réglages enregistrés avant ce défaut, sans la case, le reçoivent.
 */
export function avecLaRetraiteParDefaut(repartition: RepartitionBenefice): RepartitionBenefice {
  if (repartition.mode !== "meilleurNet" || repartition.avecRetraite !== undefined) return repartition
  return { ...repartition, avecRetraite: true }
}

/**
 * Réglages proposés à l'ouverture du comparateur pour une activité : avec des dividendes saisis, on reprend la
 * rémunération et les dividendes de la grille ; sinon, chaque statut de société prend sa rémunération au meilleur net
 * parmi celles qui valident 4 trimestres de retraite, tout le reste en dividendes, pour ne pas le pénaliser avec un
 * bénéfice qui resterait bloqué. La rémunération saisie reste proposée pour les autres modes.
 */
export function defaultComparisonOptions(session: DonneesDeLAnnee, activityId: string): ComparaisonOptions {
  const flows = session.monthlyData.flatMap(month => month.flows).filter(flow => flow.entityId === activityId)
  const annualTotal = (type: string) => flows.filter(flow => flow.type === type).reduce((sum, flow) => sum + flow.amount, 0)

  return {
    activityId,
    remunerationNette: annualTotal("director_remuneration"),
    repartition: avecLaRetraiteParDefaut({ mode: annualTotal("dividends_payment") === 0 ? "meilleurNet" : "grille", partDistribuee: 1 }),
    partBncPrestations: 1,
    fraisFonctionnement: defaultFraisFonctionnement()
  }
}

/**
 * Réglages du comparateur pour une activité et l'année affichée : ceux que l'utilisateur a choisis, et pour les autres
 * les valeurs par défaut tirées de la grille de l'année. La rémunération saisie vaut pour son année seulement ;
 * le mode de partage, la part BNC et les frais de fonctionnement valent pour toutes les années.
 */
export function optionsDuComparateur(vue: SimulationAnnuelle, activityId: string, reglages: ReglagesComparateur | undefined): ComparaisonOptions {
  const defaut = defaultComparisonOptions(vue, activityId)
  if (!reglages) return defaut
  return {
    ...defaut,
    remunerationNette: reglages.remunerationParAnnee?.[String(vue.annee)] ?? defaut.remunerationNette,
    repartition: avecLaRetraiteParDefaut(reglages.repartition ?? defaut.repartition),
    partBncPrestations: reglages.partBncPrestations ?? defaut.partBncPrestations,
    fraisFonctionnement: reglages.fraisFonctionnement ?? defaut.fraisFonctionnement
  }
}
