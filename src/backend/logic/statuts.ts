// src/backend/logic/statuts.ts

import { STATUTS_JURIDIQUES, type Relationship, type StatutJuridique } from "../../types.js"

/*
 * Ce que chaque statut juridique au réel est, indépendamment de son calcul : son nom affiché, le titre de son
 * dirigeant et le régime social de celui-ci. Tables typées par statut (`Record<StatutJuridique, …>`) : un statut ajouté
 * à `STATUTS_JURIDIQUES` (types.ts) sans ses lignes ici ne compile pas. Les calculs propres à chaque statut ont leurs
 * propres tables, au plus près du calcul (simulation-au-reel.ts, protection-sociale.ts, frais-de-fonctionnement.ts).
 */

/** Nom court d'un statut au réel, tel que l'affichent l'application, les exports et le comparateur. */
export const LIBELLES_DES_STATUTS: Record<StatutJuridique, string> = {
  SASU: "SASU",
  EURL: "EURL",
  EI: "EI au réel"
}

/**
 * Relation qui fait diriger une activité de ce statut, ou en être titulaire : la SASU a un président, l'EURL un gérant,
 * l'entreprise individuelle un titulaire. Le comparateur relie ainsi la personne principale à l'activité convertie.
 */
export const DIRIGEANT_DES_STATUTS: Record<StatutJuridique, Extract<Relationship["type"], "Président" | "Gérant" | "Titulaire">> = {
  SASU: "Président",
  EURL: "Gérant",
  EI: "Titulaire"
}

/**
 * Relations possibles entre une personne et une activité au réel, selon son statut : son dirigeant (celui de
 * `DIRIGEANT_DES_STATUTS`), des associés pour une société, des salariés partout. Sert à la saisie (graph-logic.ts) et
 * aux propositions des IA (outils/commun.ts).
 */
export const RELATIONS_PAR_STATUT: Record<StatutJuridique, Relationship["type"][]> = {
  SASU: ["Président", "Associé", "Salarié"],
  EURL: ["Gérant", "Associé", "Salarié"],
  EI: ["Titulaire", "Salarié"]
}

/**
 * Régime social du dirigeant. « assimilé salarié » : le président de SASU cotise au régime général sur sa rémunération,
 * sans caisse de profession libérale. « non salarié » : le gérant d'EURL et l'entrepreneur individuel sont travailleurs
 * non salariés et cotisent, pour une profession libérale réglementée, à sa caisse : c'est pourquoi le choix de la
 * profession leur est proposé, et pas au président de SASU.
 */
export const REGIME_DU_DIRIGEANT: Record<StatutJuridique, "assimilé salarié" | "non salarié"> = {
  SASU: "assimilé salarié",
  EURL: "non salarié",
  EI: "non salarié"
}

/** Les statuts au réel dont le dirigeant est non salarié, auxquels se propose une profession libérale réglementée. */
export const STATUTS_A_PROFESSION = STATUTS_JURIDIQUES.filter(statut => REGIME_DU_DIRIGEANT[statut] === "non salarié")
