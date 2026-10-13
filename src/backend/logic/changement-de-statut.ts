// src/backend/logic/changement-de-statut.ts

import { estSocieteIS, type FinancialFlow, type Relationship, type SessionState, type StatutCompare } from "../../types.js"
import { convertirFlux, entiteCible, estMicro, relationDuDirigeant, type Activite } from "./conversion-de-statut.js"
import { microInterdite, professionDe, raisonMicroInterdite } from "./professions.js"
import type { ReglesFiscales } from "./regles.js"

/*
 * Changement de statut d'une activité demandé par l'utilisateur, depuis sa fiche : micro-entreprise, entreprise
 * individuelle au réel, SASU ou EURL. L'entité et ses flux sont convertis comme dans le comparateur
 * (conversion-de-statut.ts), dans toutes les années de la session ; ses relations, elles, sont modifiées sur place, pour
 * garder ce que l'utilisateur a saisi (identifiants, associés d'une société qui reste une société). Le résultat dit ce
 * qui a changé, pour que l'interface le montre avant de valider.
 */

/** Le statut d'une activité tel qu'on le choisit dans sa fiche : le versement libératoire est un réglage de la micro-entreprise. */
export type StatutDUneActivite = Exclude<StatutCompare, "micro-vfl">

/** Le statut d'une activité, tel que le propose sa fiche. */
export function statutDeLActivite(activite: Activite): StatutDUneActivite {
  return activite.type === "micro-entreprise" ? "micro" : activite.legalStatus
}

/**
 * Pourquoi l'activité ne peut pas prendre ce statut ; `null` si elle le peut. La micro-entreprise est interdite aux
 * praticiens et auxiliaires médicaux : le comparateur en retire les colonnes pour la même raison (comparateur.ts).
 */
export function refusDuChangement(activite: Activite, cible: StatutDUneActivite, regles: ReglesFiscales): string | null {
  if (!estMicro(cible)) return null
  const profession = professionDe(activite, regles)
  return profession && microInterdite(profession) ? raisonMicroInterdite(profession) : null
}

/** Un changement de type de flux, et le montant qu'il concerne sur toutes les années. */
interface FluxConvertis {
  de: FinancialFlow["type"]
  vers: FinancialFlow["type"]
  montant: number
}

/** Ce que le changement a fait, pour l'expliquer : l'interface en tire ses phrases (src/lib/changement-de-statut.ts). */
export interface ChangementDeStatut {
  /** La session après le changement. */
  session: SessionState
  /** L'activité dans son nouveau statut. */
  activite: Activite
  /** Flux convertis d'un type dans un autre, montants additionnés sur toutes les années. */
  fluxConvertis: FluxConvertis[]
  /** Montants retirés, par type de flux (rémunération et dividendes d'une société qui n'en est plus une). */
  fluxRetires: Partial<Record<FinancialFlow["type"], number>>
  /** Relations dont le type a changé, avec leur type d'avant. */
  relationsChangees: { relation: Relationship; avant: Relationship["type"] }[]
  /** Relations retirées : associés d'une activité qui n'est plus une société. */
  relationsRetirees: Relationship[]
}

const RELATIONS_DE_DIRECTION: Relationship["type"][] = ["Président", "Gérant", "Titulaire"]

/**
 * Les relations après le changement, modifiées sur place : le dirigeant prend le titre du nouveau statut ; une société
 * garde ses associés ; une entreprise individuelle ou une micro-entreprise n'en a pas : sans dirigeant, le premier
 * associé reprend l'activité (comme dans le comparateur), les autres relations d'associé sont retirées. Les salariés
 * restent.
 */
function relationsApres(session: SessionState, activiteId: string, cible: StatutDUneActivite): Pick<ChangementDeStatut, "relationsChangees" | "relationsRetirees"> & { relationships: Relationship[] } {
  const personnes = new Set(session.entities.filter(e => e.type === "person").map(e => e.id))
  const deLActivite = (rel: Relationship) => (rel.fromId === activiteId && personnes.has(rel.toId)) || (rel.toId === activiteId && personnes.has(rel.fromId))
  const dirigeant = relationDuDirigeant(cible)
  const garderLesAssocies = estSocieteIS(cible)
  let reprise = !session.relationships.some(rel => deLActivite(rel) && RELATIONS_DE_DIRECTION.includes(rel.type))

  const relationsChangees: ChangementDeStatut["relationsChangees"] = []
  const relationsRetirees: Relationship[] = []
  const relationships = session.relationships.flatMap(rel => {
    if (!deLActivite(rel)) return [rel]
    const devientDirigeant = RELATIONS_DE_DIRECTION.includes(rel.type) || (rel.type === "Associé" && !garderLesAssocies && reprise)
    if (rel.type === "Associé" && !devientDirigeant && !garderLesAssocies) {
      relationsRetirees.push(rel)
      return []
    }
    if (!devientDirigeant || rel.type === dirigeant) return [rel]
    if (rel.type === "Associé") reprise = false
    const changee = { ...rel, type: dirigeant }
    relationsChangees.push({ relation: changee, avant: rel.type })
    return [changee]
  })
  return { relationships, relationsChangees, relationsRetirees }
}

/**
 * Un flux de l'activité dans le nouveau statut. D'une société à l'IS à l'autre, la rémunération du dirigeant et les
 * dividendes saisis sont gardés ; ailleurs, le comparateur les recalcule et `convertirFlux` les retire : ici, une
 * entreprise individuelle ou une micro-entreprise n'en verse pas, et une société qui vient de l'être n'en a encore
 * aucun. Un flux converti garde son identifiant.
 */
function fluxApres(flux: FinancialFlow, depuisUneSociete: boolean, cible: StatutDUneActivite, partBnc: number): FinancialFlow[] {
  const entreSocietes = depuisUneSociete && estSocieteIS(cible)
  if (entreSocietes && (flux.type === "director_remuneration" || flux.type === "dividends_payment")) return [flux]
  const convertis = convertirFlux(flux, cible, partBnc)
  return convertis.length === 1 ? [{ ...convertis[0], id: flux.id }] : convertis
}

/** Additionne un montant dans une table par clé. */
function ajouter<K extends string>(table: Partial<Record<K, number>>, cle: K, montant: number): void {
  table[cle] = (table[cle] ?? 0) + montant
}

/** Les flux de l'activité dans toutes les années, convertis, et ce qui a changé. */
function fluxDeLaSession(session: SessionState, source: Activite, cible: StatutDUneActivite, partBnc: number): Pick<ChangementDeStatut, "fluxConvertis" | "fluxRetires"> & { annees: SessionState["annees"] } {
  const depuisUneSociete = source.type === "company" && estSocieteIS(source.legalStatus)
  const convertis: Partial<Record<string, FluxConvertis>> = {}
  const fluxRetires: ChangementDeStatut["fluxRetires"] = {}
  const annees = session.annees.map(annee => ({
    ...annee,
    monthlyData: annee.monthlyData.map(mois => ({
      ...mois,
      flows: mois.flows.flatMap(flux => {
        if (flux.entityId !== source.id) return [flux]
        const apres = fluxApres(flux, depuisUneSociete, cible, partBnc)
        if (apres.length === 0) ajouter(fluxRetires, flux.type, flux.amount)
        for (const nouveau of apres.filter(f => f.type !== flux.type)) {
          const cle = `${flux.type}>${nouveau.type}`
          convertis[cle] = { de: flux.type, vers: nouveau.type, montant: (convertis[cle]?.montant ?? 0) + nouveau.amount }
        }
        return apres
      })
    }))
  }))
  return { annees, fluxConvertis: Object.values(convertis).filter((c): c is FluxConvertis => c !== undefined), fluxRetires }
}

/**
 * Donne à l'activité le statut demandé, dans toute la session : entité (réglages gardés quand ils ont un sens dans le
 * nouveau statut, voir `entiteCible`), relations et flux de chaque année. `partBncPrestations` : part des prestations
 * de services qui deviennent des prestations libérales (BNC) quand l'activité devient une micro-entreprise, le reste
 * des prestations commerciales ou artisanales (BIC). L'appelant vérifie d'abord `refusDuChangement`.
 */
export function changerLeStatut(session: SessionState, source: Activite, cible: StatutDUneActivite, partBncPrestations = 1): ChangementDeStatut {
  if (statutDeLActivite(source) === cible) return { session, activite: source, fluxConvertis: [], fluxRetires: {}, relationsChangees: [], relationsRetirees: [] }
  const activite = entiteCible(source, cible)
  const { relationships, ...relations } = relationsApres(session, source.id, cible)
  const { annees, ...flux } = fluxDeLaSession(session, source, cible, Math.min(1, Math.max(0, partBncPrestations)))
  return {
    session: { ...session, entities: session.entities.map(e => (e.id === source.id ? activite : e)), relationships, annees },
    activite,
    ...flux,
    ...relations
  }
}
