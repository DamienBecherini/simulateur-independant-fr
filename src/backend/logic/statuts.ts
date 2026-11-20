// src/backend/logic/statuts.ts

import { STATUTS_JURIDIQUES, type StatutJuridique } from "../../types.js"

/*
 * Ce que chaque statut juridique au réel est, indépendamment de son calcul : son nom affiché et le régime social de
 * son dirigeant. Qui peut y tenir quel rôle (président, gérant, associé, titulaire, salarié) est dit ailleurs, pour
 * toutes les formes d'activité : regles-de-structure.ts. Tables typées par statut (`Record<StatutJuridique, …>`) : un statut ajouté
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

/**
 * Nom d'une activité en portage salarial (voir l'ADR 016), tel que l'affichent l'application, les exports et les outils
 * pour les IA. Ce n'est pas un statut juridique : la personne est salariée de la société de portage, reliée à l'activité
 * par « Titulaire » (affiché « salarié porté »).
 */
export const LIBELLE_DU_PORTAGE = "Portage salarial"

/** Les statuts au réel dont le dirigeant est non salarié, auxquels se propose une profession libérale réglementée. */
export const STATUTS_A_PROFESSION = STATUTS_JURIDIQUES.filter(statut => REGIME_DU_DIRIGEANT[statut] === "non salarié")
