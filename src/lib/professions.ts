// src/lib/professions.ts
// Liste des professions libérales réglementées proposées sur une activité BNC, et la ligne d'information qui
// l'accompagne (voir l'ADR 015). Les professions, leur caisse et leurs taux viennent des règles de l'année.

import { caisseDe, LIBELLE_NON_REGLEMENTEE, PROFESSION_NON_REGLEMENTEE, professionDe } from "@/backend/logic/professions"
import { PREMIERE_ANNEE_DES_REGLES, reglesDeLAnnee, reglesPubliees, type ReglesFiscales } from "@/backend/logic/regles"
import type { ActivityResult, CaisseLiberale, Company, DetailCotisationsTNS, MicroEntreprise, ProfessionDeLActivite } from "@/types"

export { LIBELLE_NON_REGLEMENTEE, PROFESSION_NON_REGLEMENTEE }

/**
 * Les règles qui décrivent les professions de l'année affichée ou exportée : celles avec lesquelles l'année est
 * simulée (les dernières connues au-delà). Une année d'avant les premières règles n'est pas simulée, mais la fiche
 * d'une activité reste modifiable : la liste et la ligne d'information prennent alors les règles de la première année
 * connue, les plus proches.
 */
export function reglesDesProfessions(annee: number): ReglesFiscales {
  return reglesDeLAnnee(annee).regles ?? reglesPubliees(PREMIERE_ANNEE_DES_REGLES)
}

/** Un groupe de la liste : son titre et ses professions, dans l'ordre des règles. */
export interface GroupeDeProfessions {
  titre: string
  professions: { id: string; libelle: string }[]
}

/** Titres des groupes de la liste, une entrée par caisse, dans l'ordre de la liste (ADR 015 : la santé d'abord). */
const TITRES_DES_CAISSES: Record<CaisseLiberale, string> = { CARPIMKO: "Santé (CARPIMKO)", CIPAV: "CIPAV" }

/**
 * La liste proposée, dans l'ordre de l'ADR 015 : « Non réglementée » (hors des groupes, en tête), puis la santé
 * (CARPIMKO), puis la CIPAV, enfin « Autre profession réglementée ».
 */
export function groupesDeProfessions(regles: ReglesFiscales): { groupes: GroupeDeProfessions[]; autres: { id: string; libelle: string }[] } {
  const liste = regles.liberauxReglementes.professions.liste
  const groupes = Object.entries(TITRES_DES_CAISSES).map(([caisse, titre]) => ({ titre, professions: liste.filter(p => p.caisse === caisse).map(({ id, libelle }) => ({ id, libelle })) }))
  return { groupes, autres: liste.filter(p => p.caisse === null).map(({ id, libelle }) => ({ id, libelle })) }
}

/** « 8,7 % » : un taux en pourcentage, à la française. */
const pourcent = (taux: number) => `${(taux * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`
const euros = (montant: number) => `${Math.round(montant).toLocaleString("fr-FR")} €`

/** Retraite complémentaire de la CARPIMKO, en quelques mots : forfaitaire jusqu'en 2025, proportionnelle ensuite. */
function complementaireCarpimko(rc: ReglesFiscales["liberauxReglementes"]["CARPIMKO"]["retraiteComplementaire"]): string {
  if (rc.forfait > 0) return `complémentaire de ${euros(rc.forfait)} plus ${pourcent(rc.taux)} au-delà de ${euros(rc.seuil)}`
  return `complémentaire de ${pourcent(rc.taux)} (${euros(rc.taux * rc.assietteMinimale)} au moins)`
}

/**
 * La ligne d'information d'une profession de chaque caisse, avec les règles de l'année et la phrase de la retraite de
 * base. Une entrée par caisse : une caisse ajoutée sans sa description ne compile pas.
 */
const INFORMATION_PAR_CAISSE: Record<CaisseLiberale, (regles: ReglesFiscales, retraiteDeBase: string) => string> = {
  CIPAV: (regles, retraiteDeBase) => {
    const cipav = regles.liberauxReglementes.CIPAV
    const complementaire = `complémentaire de ${cipav.retraiteComplementaire.tranches.map(t => pourcent(t.taux)).join(" puis ")}`
    return `Caisse : CIPAV. Micro-entreprise possible, au taux de ${pourcent(cipav.microEntreprise.cotisations)} du chiffre d'affaires. Au réel, en ${regles.annee} : ${retraiteDeBase}, ${complementaire}, invalidité-décès de ${pourcent(cipav.invaliditeDeces.taux)}.`
  },
  CARPIMKO: (regles, retraiteDeBase) => {
    const carpimko = regles.liberauxReglementes.CARPIMKO
    return `Caisse : CARPIMKO. Micro-entreprise interdite aux praticiens et auxiliaires médicaux. En ${regles.annee} : ${retraiteDeBase}, ${complementaireCarpimko(carpimko.retraiteComplementaire)}, invalidité-décès de ${euros(carpimko.invaliditeDeces.forfait)}, ASV et CURPS ; l'Assurance maladie prend en charge l'essentiel de la maladie et de l'ASV sur la part conventionnée.`
  }
}

/**
 * La ligne d'information sous la liste : la caisse, la micro-entreprise possible ou non, et les principaux taux de
 * l'année des règles.
 */
export function informationSurLaProfession(activite: Pick<Company | MicroEntreprise, "profession">, regles: ReglesFiscales): string {
  const profession = professionDe(activite, regles)
  if (!profession) return "Profession libérale non réglementée, artisan ou commerçant : cotisations de la Sécurité sociale des indépendants."
  const caisse = caisseDe(profession)
  if (!caisse) return "Caisse pas encore prise en compte par le simulateur : cotisations calculées comme pour une profession libérale non réglementée, avec un avertissement."
  const retraiteDeBase = `retraite de base des libéraux (${pourcent(regles.liberauxReglementes.commun.retraiteDeBase.tranches[0].taux)} jusqu'au plafond de la sécurité sociale)`
  return INFORMATION_PAR_CAISSE[caisse](regles, retraiteDeBase)
}

/** La profession peut être conventionnée : le champ « part conventionnée » a un sens. */
export function estConventionnable(activite: Pick<Company | MicroEntreprise, "profession">, regles: ReglesFiscales): boolean {
  return professionDe(activite, regles)?.conventionnable ?? false
}

/**
 * L'activité après le choix d'une profession : « non réglementée » retire le champ, comme une profession qui ne peut
 * pas être conventionnée retire la part conventionnée.
 */
export function avecLaProfession<T extends Company | MicroEntreprise>(activite: T, id: string, regles: ReglesFiscales): T {
  const reste = Object.fromEntries(Object.entries(activite).filter(([cle]) => cle !== "profession" && cle !== "partConventionnee")) as T
  if (id === PROFESSION_NON_REGLEMENTEE) return reste
  const garderLaPart = activite.partConventionnee !== undefined && estConventionnable({ profession: id }, regles)
  return { ...reste, profession: id, ...(garderLaPart ? { partConventionnee: activite.partConventionnee } : {}) }
}

/** « Ostéopathe (CIPAV, 23,2 % du chiffre d'affaires) », « Infirmier ou infirmière (CARPIMKO) ». */
export function libelleDeLaProfession({ libelle, caisse, tauxMicro }: ProfessionDeLActivite): string {
  if (!caisse) return `${libelle} (caisse non prise en compte)`
  const taux = tauxMicro === undefined ? "" : `, ${tauxMicro.toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 })} du chiffre d'affaires`
  return `${libelle} (${caisse}${taux})`
}

/** Statut d'une activité suivi de sa profession réglementée : « EI au réel · Ostéopathe (CIPAV) ». */
export function statutEtProfession(activite: Pick<ActivityResult, "statut" | "profession">): string {
  return activite.profession ? `${activite.statut} · ${libelleDeLaProfession(activite.profession)}` : activite.statut
}

/**
 * La profession saisie sur une activité, pour une fiche ou un export : « Ostéopathe (CIPAV) », « Infirmier ou
 * infirmière (CARPIMKO), part conventionnée 80 % » ; `null` sans profession réglementée.
 */
export function professionDeLaFiche(activite: Pick<Company | MicroEntreprise, "profession" | "partConventionnee">, regles: ReglesFiscales): string | null {
  const profession = professionDe(activite, regles)
  if (!profession) return null
  const libelle = libelleDeLaProfession({ id: profession.id, libelle: profession.libelle, caisse: caisseDe(profession) })
  const part = profession.conventionnable ? `, part conventionnée ${Math.round((activite.partConventionnee ?? 1) * 100)} %` : ""
  return `${libelle}${part}`
}

/** Une ligne des cotisations d'une profession libérale réglementée au réel, et ce qui la précise. */
export interface LigneDeLaCaisse {
  libelle: string
  montant: number
  precision: string | null
}

/**
 * Les cotisations que la caisse d'une profession libérale réglementée change, ligne à ligne, avec ce que l'Assurance
 * maladie prend en charge et, pour la CARPIMKO, l'année du revenu de la complémentaire et de l'ASV ; rien sans caisse.
 * `montant` met en forme les montants des précisions.
 */
export function lignesDeLaCaisse(tns: DetailCotisationsTNS, montant: (valeur: number) => string): LigneDeLaCaisse[] {
  const caisse = tns.caisse
  if (!caisse) return []
  const base = caisse.baseDesCotisationsDeLAnneePrecedente
  const surLeRevenu = base ? `calculée sur le revenu ${base.annee}${base.anneePrecedenteConnue ? "" : ` (${base.annee - 1} n'est pas dans la simulation)`}` : null
  const priseEnCharge = (valeur: number) => (valeur >= 0.5 ? `${montant(valeur)} pris en charge par l'Assurance maladie` : null)
  const c = tns.cotisations
  const lignes: LigneDeLaCaisse[] = [
    { libelle: "dont maladie (Urssaf)", montant: c.maladieMaternite, precision: priseEnCharge(caisse.priseEnCharge.maladie) },
    { libelle: "dont retraite de base (CNAVPL)", montant: c.retraiteDeBase, precision: null },
    { libelle: `dont retraite complémentaire (${caisse.caisse})`, montant: c.retraiteComplementaire, precision: surLeRevenu },
    { libelle: `dont invalidité-décès (${caisse.caisse})`, montant: c.invaliditeDeces, precision: null }
  ]
  if (caisse.asv > 0) lignes.push({ libelle: "dont avantage social vieillesse (ASV)", montant: caisse.asv, precision: [surLeRevenu, priseEnCharge(caisse.priseEnCharge.asv)].filter(Boolean).join(" ; ") })
  if (caisse.curps > 0) lignes.push({ libelle: "dont CURPS", montant: caisse.curps, precision: "unions régionales des professionnels de santé" })
  return lignes
}

/** La liste vaut pour une micro-entreprise, une entreprise individuelle au réel et un gérant d'EURL, pas une SASU. */
export function proposeLaProfession(activite: Company | MicroEntreprise): boolean {
  return activite.type === "micro-entreprise" || activite.legalStatus !== "SASU"
}
