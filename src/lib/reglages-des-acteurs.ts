// src/lib/reglages-des-acteurs.ts
// Les réglages d'un acteur en quelques mots : type en une pastille, et, à l'impression de l'affichage « Panneaux »
// (où ils ne sont plus à l'écran que dans le panneau de l'acteur), tous ses réglages en clair.

import type { Entity, Relationship } from "@/types"
import { getRelationshipLabel } from "./graph-logic"
import { euros } from "./resume"

/** Type de l'acteur en une pastille : « Personne · 1 part », « Micro-entreprise », « SASU ». */
export function typeCourt(entity: Entity): string {
  if (entity.type === "person") return `Personne · ${entity.fiscalParts.toLocaleString("fr-FR")} ${entity.fiscalParts > 1 ? "parts" : "part"}`
  if (entity.type === "micro-entreprise") return "Micro-entreprise"
  return entity.legalStatus === "EI" ? "EI au réel" : entity.legalStatus
}

const ouiNon = (valeur: boolean) => (valeur ? "oui" : "non")
const kilometres = (km: number) => `${km.toLocaleString("fr-FR")} km`
const voiture = ({ puissanceFiscale, electrique }: { puissanceFiscale: string; electrique: boolean }) => `${puissanceFiscale} CV${electrique ? ", électrique" : ""}`

/** Frais professionnels d'une personne : la déduction de 10 %, ou ses frais réels à comparer. */
function fraisDeLaPersonne(entity: Extract<Entity, { type: "person" }>): string {
  const frais = entity.fraisReels
  if (!frais) return "Frais sur les salaires : déduction de 10 %"
  const trajets = frais.trajets.map(t => `${t.libelle.trim() || "trajet"} ${kilometres(t.kmParTrajet)}, ${t.joursTravailles} jours, ${voiture(t)}`)
  return `Frais réels comparés à la déduction de 10 % : ${[...trajets, `${euros(frais.autresFrais)} d'autres frais`].join(" ; ")}`
}

/** Réglages propres au type de l'acteur. */
function reglagesDuType(entity: Entity): string[] {
  if (entity.type === "person") return [`Parts propres : ${entity.fiscalParts.toLocaleString("fr-FR")}`, fraisDeLaPersonne(entity)]
  const deplacements = entity.deplacementsProfessionnels ? [`Déplacements professionnels : ${kilometres(entity.deplacementsProfessionnels.kmParAn)} par an, ${voiture(entity.deplacementsProfessionnels)}`] : []
  if (entity.type === "micro-entreprise") {
    return [`ACRE : ${ouiNon(entity.beneficieACRE)}`, `Versement libératoire : ${ouiNon(entity.opteVFL)}`, `RFR N-2 : ${entity.rfrN2 === undefined ? "non renseigné" : euros(entity.rfrN2)}`, ...deplacements]
  }
  return [...(entity.legalStatus === "EURL" ? [`Capital social : ${euros(entity.capitalSocial)}`] : []), ...deplacements]
}

/** Relations de l'acteur, vues de son côté, comme sur ses pastilles : « Président → Conseil SASU ». */
function relationsDeLActeur(entity: Entity, entities: Entity[], relationships: Relationship[]): string[] {
  return relationships.flatMap(relation => {
    const estSource = relation.fromId === entity.id
    if (!estSource && relation.toId !== entity.id) return []
    const autre = entities.find(e => e.id === (estSource ? relation.toId : relation.fromId))
    if (!autre) return []
    const libelle = getRelationshipLabel(relation.type, estSource)
    return [estSource ? `${libelle} → ${autre.name}` : `← ${libelle} ${autre.name}`]
  })
}

/** Tous les réglages d'un acteur, une ligne par réglage, pour l'impression. */
export function lignesDesReglages(entity: Entity, entities: Entity[], relationships: Relationship[]): string[] {
  const relations = relationsDeLActeur(entity, entities, relationships)
  return [...reglagesDuType(entity), relations.length > 0 ? `Relations : ${relations.join(" ; ")}` : "Aucune relation", ...(entity.locked ? ["Verrouillé"] : [])]
}
