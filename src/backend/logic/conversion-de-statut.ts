// src/backend/logic/conversion-de-statut.ts

import { CAPITAL_SOCIAL_PAR_DEFAUT, estSocieteIS, type Company, type DonneesDeLAnnee, type FinancialFlow, type MicroEntreprise, type Relationship, type StatutCompare } from "../../types.js"
import { DIRIGEANT_DES_STATUTS } from "./statuts.js"

/*
 * Conversion d'une activité dans un autre statut : l'entité change de type, ses relations prennent le titre du
 * dirigeant de ce statut et ses flux leur équivalent (chiffre d'affaires, charges), sans rien ajouter. Le reste des
 * données de l'année ne change pas. Sert au comparateur (une colonne par statut) et à la simulation des années, qui
 * simule au réel une micro-entreprise sortie du régime micro (simulation-pluriannuelle.ts).
 */

/** Une activité : société ou entreprise individuelle au réel, ou micro-entreprise. */
export type Activite = Company | MicroEntreprise

type Nature = "vente" | "services" | "bic" | "bnc" | "charges" | "remuneration" | "dividendes" | "autre"

const NATURE_DES_FLUX: Partial<Record<FinancialFlow["type"], Nature>> = {
  ca_vente: "vente",
  ca_micro_vente: "vente",
  ca_services: "services",
  ca_micro_services_bic: "bic",
  ca_micro_services_bnc: "bnc",
  deductible_expense: "charges",
  expense: "charges",
  director_remuneration: "remuneration",
  dividends_payment: "dividendes"
}

/** Les deux colonnes de la micro-entreprise, avec et sans versement libératoire : tout autre statut est au réel. */
export function estMicro(statut: StatutCompare): statut is "micro" | "micro-vfl" {
  return statut === "micro" || statut === "micro-vfl"
}

/** Le statut d'une activité, tel que le comparateur le nomme. */
export function statutActuel(activite: Activite): StatutCompare {
  if (activite.type === "micro-entreprise") return activite.opteVFL ? "micro-vfl" : "micro"
  return activite.legalStatus
}

/** L'activité à comparer, ou `undefined` si l'identifiant ne désigne aucune activité. */
export function activiteComparee(session: DonneesDeLAnnee, activityId: string): Activite | undefined {
  return session.entities.find((e): e is Activite => e.id === activityId && e.type !== "person")
}

/** Type d'un flux de l'activité dans le statut cible ; `null` si le flux n'y a pas d'équivalent. */
function typeCible(nature: Nature, statut: StatutCompare): FinancialFlow["type"] | null {
  if (estMicro(statut)) {
    const pourMicro: Partial<Record<Nature, FinancialFlow["type"]>> = { vente: "ca_micro_vente", bic: "ca_micro_services_bic", bnc: "ca_micro_services_bnc", charges: "expense" }
    return pourMicro[nature] ?? null
  }
  const pourReel: Partial<Record<Nature, FinancialFlow["type"]>> = { vente: "ca_vente", services: "ca_services", bic: "ca_services", bnc: "ca_services", charges: "deductible_expense" }
  return pourReel[nature] ?? null
}

/**
 * Convertit un flux de l'activité vers le statut cible. Les prestations d'une société deviennent, en micro,
 * du BNC ou du BIC selon la part choisie ; la rémunération et les dividendes sont recalculés à part.
 */
function convertirFlux(flux: FinancialFlow, statut: StatutCompare, partBnc: number): FinancialFlow[] {
  const nature = NATURE_DES_FLUX[flux.type] ?? "autre"
  if (nature === "autre") return [flux]
  if (nature === "remuneration" || nature === "dividendes") return []

  if (nature === "services" && estMicro(statut)) {
    const parts: [FinancialFlow["type"], number][] = [
      ["ca_micro_services_bnc", flux.amount * partBnc],
      ["ca_micro_services_bic", flux.amount * (1 - partBnc)]
    ]
    return parts.filter(([, amount]) => amount > 0).map(([type, amount]) => ({ ...flux, id: `${flux.id}-${type}`, type, amount, grossAmount: undefined }))
  }

  const type = typeCible(nature, statut)
  return type ? [{ ...flux, type }] : []
}

/** Personnes reliées à l'activité : la principale (dirigeant ou titulaire) et les autres associés. */
export function personnesDeLActivite(session: DonneesDeLAnnee, activiteId: string): { principale: string | undefined; associes: string[] } {
  const personIds = new Set(session.entities.filter(e => e.type === "person").map(e => e.id))
  const liees = (types: Relationship["type"][]) =>
    session.relationships.filter(rel => types.includes(rel.type) && (rel.fromId === activiteId || rel.toId === activiteId)).map(rel => (rel.fromId === activiteId ? rel.toId : rel.fromId)).filter(id => personIds.has(id))

  const principale = liees(["Président", "Gérant", "Titulaire"])[0] ?? liees(["Associé"])[0]
  const associes = [...new Set(liees(["Associé"]))].filter(id => id !== principale)
  return { principale, associes }
}

/** Ce que l'activité garde dans tout statut : son identité et ce dont dépend son calcul. */
function champsQuiSuivent(source: Activite) {
  return {
    id: source.id,
    name: source.name,
    avatar: source.avatar,
    locked: source.locked,
    // Les déplacements professionnels suivent l'activité dans chaque statut : le moteur les convertit au barème de
    // l'année, en charge déductible (société, EI) ou en simple dépense (micro-entreprise).
    ...(source.deplacementsProfessionnels ? { deplacementsProfessionnels: source.deplacementsProfessionnels } : {}),
    // La date de création suit l'activité : ACRE, plafonds au prorata et CFE en dépendent dans chaque statut.
    ...(source.dateDeCreation ? { dateDeCreation: source.dateDeCreation } : {}),
    // La profession aussi : sa caisse, son taux micro et ses avertissements s'appliquent dans chaque statut (ADR 015).
    ...(source.profession === undefined ? {} : { profession: source.profession }),
    ...(source.partConventionnee === undefined ? {} : { partConventionnee: source.partConventionnee })
  }
}

/** La micro-entreprise de la colonne : l'ACRE et le revenu fiscal de référence d'une micro-entreprise la suivent. */
function microCible(source: Activite, statut: "micro" | "micro-vfl"): MicroEntreprise {
  const micro = source.type === "micro-entreprise" ? source : undefined
  return { ...champsQuiSuivent(source), type: "micro-entreprise", beneficieACRE: micro?.beneficieACRE ?? false, opteVFL: statut === "micro-vfl", ...(micro?.rfrN2 !== undefined ? { rfrN2: micro.rfrN2 } : {}) }
}

/** La société ou l'entreprise individuelle au réel de la colonne. */
function reelCible(source: Activite, statut: Company["legalStatus"]): Company {
  // Le capital d'une société à l'IS la suit dans l'autre statut de société (capital par défaut sinon) ; l'EI n'en a pas.
  const capitalSource = source.type === "company" && estSocieteIS(source.legalStatus) ? source.capitalSocial : CAPITAL_SOCIAL_PAR_DEFAUT
  return { ...champsQuiSuivent(source), type: "company", legalStatus: statut, capitalSocial: estSocieteIS(statut) ? capitalSource : 0, ...reservesQuiSuivent(source, statut) }
}

/** L'activité dans le statut de la colonne. */
function entiteCible(source: Activite, statut: StatutCompare): Activite {
  return estMicro(statut) ? microCible(source, statut) : reelCible(source, statut)
}

/** Les réserves de départ d'une société à l'IS la suivent dans l'autre statut de société (voir l'ADR 014). */
function reservesQuiSuivent(source: Activite, statut: StatutCompare): Pick<Company, "reservesInitiales"> {
  return source.type === "company" && source.reservesInitiales !== undefined && estSocieteIS(statut) ? { reservesInitiales: source.reservesInitiales } : {}
}

function relationsCibles(session: DonneesDeLAnnee, source: Activite, statut: StatutCompare): Relationship[] {
  const { principale, associes } = personnesDeLActivite(session, source.id)
  // Les salariés de l'activité le restent dans tous les statuts : leur coût employeur pèse sur chaque colonne.
  const autres = session.relationships.filter(rel => rel.type === "Salarié" || (rel.fromId !== source.id && rel.toId !== source.id))
  if (!principale) return autres

  const lien = (personId: string, type: Relationship["type"]): Relationship => ({ id: `comparateur-${source.id}-${personId}-${type}`, fromId: personId, toId: source.id, type })
  // Une micro-entreprise a un titulaire, chaque statut au réel le dirigeant de `DIRIGEANT_DES_STATUTS` ; seule une
  // société garde ses associés.
  const dirigeant = lien(principale, estMicro(statut) ? "Titulaire" : DIRIGEANT_DES_STATUTS[statut])
  return estSocieteIS(statut) ? [...autres, dirigeant, ...associes.map(id => lien(id, "Associé"))] : [...autres, dirigeant]
}

/**
 * Données de l'année dans lesquelles l'activité a pris le statut demandé : entité, relations et flux convertis, sans
 * rien ajouter. Les dividendes saisis sont gardés tels quels si on le demande, quand le statut cible est une société.
 */
export function convertirLActivite(session: DonneesDeLAnnee, source: Activite, statut: StatutCompare, partBncPrestations = 1, garderLesDividendes = false): DonneesDeLAnnee {
  const partBnc = Math.min(1, Math.max(0, partBncPrestations))
  const monthlyData = session.monthlyData.map(mois => ({
    ...mois,
    flows: mois.flows.flatMap(flux => {
      if (flux.entityId !== source.id) return [flux]
      if (flux.type === "dividends_payment" && estSocieteIS(statut) && garderLesDividendes) return [flux]
      return convertirFlux(flux, statut, partBnc)
    })
  }))
  return {
    ...session,
    entities: session.entities.map(e => (e.id === source.id ? entiteCible(source, statut) : e)),
    relationships: relationsCibles(session, source, statut),
    monthlyData
  }
}
