// src/lib/professions.ts
// Liste des professions libérales réglementées proposées sur une activité BNC, et la ligne d'information qui
// l'accompagne (voir l'ADR 015). Les professions, leur caisse et leurs taux viennent des règles de l'année.

import { caisseDe, LIBELLE_NON_REGLEMENTEE, PROFESSION_NON_REGLEMENTEE, professionDe } from "@/backend/logic/professions"
import { reglesEnVigueur, type ReglesFiscales } from "@/backend/logic/regles"
import type { Company, MicroEntreprise } from "@/types"

export { LIBELLE_NON_REGLEMENTEE, PROFESSION_NON_REGLEMENTEE }

/** Un groupe de la liste : son titre et ses professions, dans l'ordre des règles. */
export interface GroupeDeProfessions {
  titre: string
  professions: { id: string; libelle: string }[]
}

/** Titres des groupes de la liste, par caisse. */
const TITRES_DES_CAISSES: Record<string, string> = { CARPIMKO: "Santé (CARPIMKO)", CIPAV: "CIPAV" }

/**
 * La liste proposée, dans l'ordre de l'ADR 015 : « Non réglementée » (hors des groupes, en tête), puis la santé
 * (CARPIMKO), puis la CIPAV, enfin « Autre profession réglementée ».
 */
export function groupesDeProfessions(regles: ReglesFiscales = reglesEnVigueur): { groupes: GroupeDeProfessions[]; autres: { id: string; libelle: string }[] } {
  const liste = regles.liberauxReglementes.professions.liste
  const groupes = Object.entries(TITRES_DES_CAISSES).map(([caisse, titre]) => ({ titre, professions: liste.filter(p => p.caisse === caisse).map(({ id, libelle }) => ({ id, libelle })) }))
  return { groupes, autres: liste.filter(p => p.caisse === null).map(({ id, libelle }) => ({ id, libelle })) }
}

/** « 8,7 % » : un taux en pourcentage, à la française. */
const pourcent = (taux: number) => `${(taux * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`
const euros = (montant: number) => `${Math.round(montant).toLocaleString("fr-FR")} €`

/** La retraite complémentaire d'une caisse, en quelques mots. */
function complementaire(regles: ReglesFiscales, caisse: "CIPAV" | "CARPIMKO"): string {
  if (caisse === "CIPAV") return `complémentaire de ${regles.liberauxReglementes.CIPAV.retraiteComplementaire.tranches.map(t => pourcent(t.taux)).join(" puis ")}`
  const rc = regles.liberauxReglementes.CARPIMKO.retraiteComplementaire
  if (rc.forfait > 0) return `complémentaire de ${euros(rc.forfait)} plus ${pourcent(rc.taux)} au-delà de ${euros(rc.seuil)}`
  return `complémentaire de ${pourcent(rc.taux)} (${euros(rc.taux * rc.assietteMinimale)} au moins)`
}

/**
 * La ligne d'information sous la liste : la caisse, la micro-entreprise possible ou non, et les principaux taux de
 * l'année des règles.
 */
export function informationSurLaProfession(activite: Pick<Company | MicroEntreprise, "profession">, regles: ReglesFiscales = reglesEnVigueur): string {
  const profession = professionDe(activite, regles)
  if (!profession) return "Profession libérale non réglementée, artisan ou commerçant : cotisations de la Sécurité sociale des indépendants."
  const caisse = caisseDe(profession)
  if (!caisse) return "Caisse pas encore prise en compte par le simulateur : cotisations calculées comme pour une profession libérale non réglementée, avec un avertissement."
  const l = regles.liberauxReglementes
  const retraiteDeBase = `retraite de base des libéraux (${pourcent(l.commun.retraiteDeBase.tranches[0].taux)} jusqu'au plafond de la sécurité sociale)`
  if (caisse === "CIPAV") {
    return `Caisse : CIPAV. Micro-entreprise possible, au taux de ${pourcent(l.CIPAV.microEntreprise.cotisations)} du chiffre d'affaires. Au réel, en ${regles.annee} : ${retraiteDeBase}, ${complementaire(regles, caisse)}, invalidité-décès de ${pourcent(l.CIPAV.invaliditeDeces.taux)}.`
  }
  return `Caisse : CARPIMKO. Micro-entreprise interdite aux praticiens et auxiliaires médicaux. En ${regles.annee} : ${retraiteDeBase}, ${complementaire(regles, caisse)}, invalidité-décès de ${euros(l.CARPIMKO.invaliditeDeces.forfait)}, ASV et CURPS ; l'Assurance maladie prend en charge l'essentiel de la maladie et de l'ASV sur la part conventionnée.`
}

/** La profession peut être conventionnée : le champ « part conventionnée » a un sens. */
export function estConventionnable(activite: Pick<Company | MicroEntreprise, "profession">, regles: ReglesFiscales = reglesEnVigueur): boolean {
  return professionDe(activite, regles)?.conventionnable ?? false
}

/**
 * L'activité après le choix d'une profession : « non réglementée » retire le champ, comme une profession qui ne peut
 * pas être conventionnée retire la part conventionnée.
 */
export function avecLaProfession<T extends Company | MicroEntreprise>(activite: T, id: string, regles: ReglesFiscales = reglesEnVigueur): T {
  const reste = Object.fromEntries(Object.entries(activite).filter(([cle]) => cle !== "profession" && cle !== "partConventionnee")) as T
  if (id === PROFESSION_NON_REGLEMENTEE) return reste
  const garderLaPart = activite.partConventionnee !== undefined && estConventionnable({ profession: id }, regles)
  return { ...reste, profession: id, ...(garderLaPart ? { partConventionnee: activite.partConventionnee } : {}) }
}

/** La liste vaut pour une micro-entreprise, une entreprise individuelle au réel et un gérant d'EURL, pas une SASU. */
export function proposeLaProfession(activite: Company | MicroEntreprise): boolean {
  return activite.type === "micro-entreprise" || activite.legalStatus !== "SASU"
}
