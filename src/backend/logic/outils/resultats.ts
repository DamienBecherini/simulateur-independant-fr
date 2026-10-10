// src/backend/logic/outils/resultats.ts
// Outils qui rendent les résultats du moteur : une année, toutes les années, et le détail d'un acteur. Chaque montant
// vient de simulerLesAnnees, comme à l'écran ; l'outil ne fait qu'arrondir à l'euro et nommer les lignes en français.

import { z } from "zod"
import type { ActivityResult, CotisationSalarie, CotisationTNS, DetailCotisationsSalarie, DetailCotisationsTNS, FoyerFiscalResult, PersonResult, ReservesDeLaSociete, SessionState, SimulationReport } from "../../../types.js"
import { pourcent } from "../format.js"
import { simulerLesAnnees } from "../simulation-pluriannuelle.js"
import { anneeDeLaSession, arrondir, ErreurOutil, genreDe, nomDe, trouverActeur } from "./commun.js"
import { AnneeSchema, IdentifiantSchema } from "./limites.js"
import { definirOutil, resultatSeul } from "./outil.js"

/** Le rapport du moteur pour une année de la session (la plus récente sans année demandée). */
export function rapportDeLAnnee(session: SessionState, annee?: number): SimulationReport {
  const anneeRetenue = anneeDeLaSession(session, annee)
  const resultat = simulerLesAnnees(session).annees.find(a => a.annee === anneeRetenue)
  if (!resultat?.report) throw new ErreurOutil(`L'année ${anneeRetenue} ne peut pas être simulée : ${resultat?.erreur ?? "erreur inconnue"}`)
  return resultat.report
}

/** Les mêmes champs, chaque montant arrondi à l'euro. */
export function arrondirTout<T extends Record<string, number>>(montants: T): T {
  return Object.fromEntries(Object.entries(montants).map(([cle, valeur]) => [cle, arrondir(valeur)])) as T
}

const Montants = z.record(z.string(), z.number())

// ===================================================================================
// == simuler
// ===================================================================================

const FoyerSchema = z.object({ personnes: z.array(z.string()), parts: z.number(), revenusEncaisses: z.number(), revenuImposable: z.number(), revenuFiscalDeReference: z.number(), impotSurLeRevenu: z.number(), prelevementsSociaux: z.number(), optionDividendes: z.enum(["pfu", "bareme"]).nullable(), netApresImpots: z.number(), resultatConserve: z.number(), avertissements: z.array(z.string()) })

function resumeDuFoyer(session: SessionState, foyer: FoyerFiscalResult): z.infer<typeof FoyerSchema> {
  return {
    personnes: foyer.personIds.map(id => nomDe(session, id)),
    parts: foyer.totalParts,
    revenusEncaisses: arrondir(foyer.revenusEncaisses),
    revenuImposable: arrondir(foyer.revenuImposableGlobal),
    revenuFiscalDeReference: arrondir(foyer.revenuFiscalDeReference),
    impotSurLeRevenu: arrondir(foyer.impotSurLeRevenu),
    prelevementsSociaux: arrondir(foyer.prelevementsSociaux),
    optionDividendes: foyer.optionDividendes,
    netApresImpots: arrondir(foyer.netApresImpots),
    resultatConserve: arrondir(foyer.resultatConserve),
    avertissements: foyer.warnings
  }
}

const ActiviteSchema = z.object({ id: z.string(), nom: z.string(), statut: z.string(), chiffreAffaires: z.number(), charges: z.number(), cotisationsSociales: z.number(), impotSocietes: z.number(), revenuVerse: z.number(), resultatConserve: z.number(), reservesALaFin: z.number().optional(), dispositifs: z.array(z.string()), avertissements: z.array(z.string()) })

const resumeDeLActivite = (a: ActivityResult): z.infer<typeof ActiviteSchema> => ({
  id: a.entityId,
  nom: a.name,
  statut: a.statut,
  ...arrondirTout({ chiffreAffaires: a.chiffreAffaires, charges: a.charges, cotisationsSociales: a.cotisationsSociales, impotSocietes: a.impotSocietes, revenuVerse: a.revenuVerse, resultatConserve: a.resultatConserve }),
  // Société à l'IS : ses réserves distribuables au 31 décembre, reportées d'une année à l'autre (voir l'ADR 014).
  ...(a.reserves ? { reservesALaFin: arrondir(a.reserves.aLaFin.reserves) } : {}),
  dispositifs: a.dispositifs ?? [],
  avertissements: a.warnings
})

const PersonneSchema = z.object({ id: z.string(), nom: z.string(), revenusDirects: z.number(), revenusActivites: z.number(), cotisationsSalariales: z.number(), depenses: z.number() })

const resumeDeLaPersonne = (p: PersonResult): z.infer<typeof PersonneSchema> => ({ id: p.entityId, nom: p.name, ...arrondirTout({ revenusDirects: p.revenusDirects, revenusActivites: p.revenusActivites, cotisationsSalariales: p.cotisationsSalariales, depenses: p.depenses }) })

export const simuler = definirOutil({
  nom: "simuler",
  titre: "Simuler une année",
  description: [
    "Calcule une année de la simulation avec le moteur du simulateur et en rend le résumé : bilan (chiffre d'affaires, charges, cotisations, impôt sur les sociétés, impôt sur le revenu, prélèvements sociaux, résultat conservé), chaque foyer fiscal (net après impôts, impôt sur le revenu, revenu fiscal de référence), chaque activité et chaque personne.",
    "Société à l'IS : resultatConserve est ce que ses réserves gagnent dans l'année (négatif si elle distribue plus que son bénéfice de l'année, en puisant dans les réserves des années précédentes, ou si elle est déficitaire) ; reservesALaFin, ses réserves distribuables au 31 décembre, reportées d'une année à l'autre.",
    "Montants annuels en euros, arrondis à l'euro. C'est la seule source des chiffres à donner à l'utilisateur : ne les recalculez pas.",
    "Pour le détail d'une ligne (cotisations ligne à ligne, partage du bénéfice, versement libératoire), utilisez expliquer_resultat."
  ].join(" "),
  lecture: true,
  parametres: z.strictObject({ annee: AnneeSchema.optional().describe("Année à simuler ; par défaut, la plus récente de la simulation.") }),
  resultat: z.object({ annee: z.number(), anneeDesRegles: z.number(), avertissements: z.array(z.string()), totalNetApresImpots: z.number(), bilan: Montants, foyers: z.array(FoyerSchema), activites: z.array(ActiviteSchema), personnes: z.array(PersonneSchema) }),
  executer: (session, { annee }) => {
    const rapport = rapportDeLAnnee(session, annee)
    return resultatSeul({
      annee: rapport.annee,
      anneeDesRegles: rapport.anneeDesRegles,
      avertissements: rapport.avertissements,
      totalNetApresImpots: arrondir(rapport.totalNetApresImpots),
      bilan: arrondirTout({ ...rapport.bilan }),
      foyers: rapport.foyers.map(foyer => resumeDuFoyer(session, foyer)),
      activites: rapport.activities.map(resumeDeLActivite),
      personnes: rapport.persons.map(resumeDeLaPersonne)
    })
  }
})

// ===================================================================================
// == synthese_des_annees
// ===================================================================================

const LigneAnnuelleSchema = z.object({ annee: z.number(), erreur: z.string().nullable(), totalNetApresImpots: z.number().nullable(), chiffreAffaires: z.number().nullable(), totalPrelevements: z.number().nullable(), impotSurLeRevenu: z.number().nullable(), cotisationsSociales: z.number().nullable(), resultatConserve: z.number().nullable() })

export const syntheseDesAnnees = definirOutil({
  nom: "synthese_des_annees",
  titre: "Synthèse de toutes les années",
  description:
    "Une ligne par année de la simulation, calculée par le moteur : net après impôts de tous les foyers, chiffre d'affaires, total des prélèvements, impôt sur le revenu, cotisations sociales et résultat conservé dans les sociétés. Montants annuels en euros, arrondis. Une année que le simulateur ne sait pas calculer (règles inconnues) porte son erreur et des montants nuls (null). Pour comparer des années ou voir une évolution ; pour le détail d'une année, utilisez simuler.",
  lecture: true,
  parametres: z.strictObject({}),
  resultat: z.object({ annees: z.array(LigneAnnuelleSchema) }),
  executer: session =>
    resultatSeul({
      annees: simulerLesAnnees(session).annees.map(({ annee, report, erreur }) => {
        const b = report?.bilan
        const ou = (valeur: number | undefined) => (valeur === undefined ? null : arrondir(valeur))
        return { annee, erreur, totalNetApresImpots: ou(report?.totalNetApresImpots), chiffreAffaires: ou(b?.chiffreAffaires), totalPrelevements: ou(b?.totalPrelevements), impotSurLeRevenu: ou(b?.impotSurLeRevenu), cotisationsSociales: ou(b?.cotisationsSociales), resultatConserve: ou(b?.resultatConserve) }
      })
    })
})

// ===================================================================================
// == expliquer_resultat
// ===================================================================================

const LIBELLES_TNS: Record<CotisationTNS, string> = {
  maladieMaternite: "Maladie-maternité",
  indemnitesJournalieres: "Indemnités journalières",
  retraiteDeBase: "Retraite de base",
  retraiteComplementaire: "Retraite complémentaire",
  invaliditeDeces: "Invalidité-décès",
  allocationsFamiliales: "Allocations familiales",
  csgDeductible: "CSG déductible",
  csgNonDeductibleEtCrds: "CSG non déductible et CRDS",
  formationProfessionnelle: "Formation professionnelle"
}

const LIBELLES_REGIME_GENERAL: Record<CotisationSalarie, string> = {
  maladie: "Maladie",
  vieillessePlafonnee: "Vieillesse plafonnée",
  vieillesseDeplafonnee: "Vieillesse déplafonnée",
  allocationsFamiliales: "Allocations familiales",
  accidentsDuTravail: "Accidents du travail",
  contributionSolidariteAutonomie: "Contribution solidarité autonomie",
  fnal: "Fonds national d'aide au logement",
  retraiteComplementaire: "Retraite complémentaire",
  contributionEquilibreGeneral: "Contribution d'équilibre général",
  contributionEquilibreTechnique: "Contribution d'équilibre technique",
  assuranceChomage: "Assurance chômage",
  ags: "Garantie des salaires (AGS)",
  dialogueSocial: "Dialogue social",
  formationProfessionnelle: "Formation professionnelle",
  taxeApprentissage: "Taxe d'apprentissage",
  csgDeductible: "CSG déductible",
  csgNonDeductibleEtCrds: "CSG non déductible et CRDS"
}

const ComposanteSchema = z.object({ libelle: z.string(), montant: z.number() })
const LigneSchema = z.object({ libelle: z.string(), montant: z.number(), composantes: z.array(ComposanteSchema).optional() })
type Ligne = z.infer<typeof LigneSchema>

const ligne = (libelle: string, montant: number, composantes?: Ligne["composantes"]): Ligne => ({ libelle, montant: arrondir(montant), ...(composantes ? { composantes } : {}) })
const composante = (libelle: string, montant: number) => ({ libelle, montant: arrondir(montant) })

function lignesTNS(detail: DetailCotisationsTNS): Ligne {
  const composantes = (Object.keys(LIBELLES_TNS) as CotisationTNS[]).map(cle => composante(LIBELLES_TNS[cle], detail.cotisations[cle]))
  // Profession libérale réglementée : l'ASV et la CURPS s'ajoutent aux lignes, comprises dans le total.
  const caisse = detail.caisse ? [composante("Avantage social vieillesse (ASV)", detail.caisse.asv), composante("CURPS", detail.caisse.curps)] : []
  const titre = detail.caisse ? `Cotisations du travailleur non salarié, ${detail.caisse.libelleProfession} (${detail.caisse.caisse})` : "Cotisations du travailleur non salarié"
  return ligne(`${titre} (assiette ${arrondir(detail.assiette)} € après abattement)`, detail.total, [...composantes, ...caisse])
}

/** Profession libérale réglementée : profession, caisse, prise en charge et revenu de la complémentaire de la CARPIMKO. */
function informationsDeLaProfession(a: ActivityResult): string[] {
  if (!a.profession) return []
  const caisse = a.cotisationsTNS?.caisse
  const taux = a.profession.tauxMicro === undefined ? "" : `, taux global de ${(a.profession.tauxMicro * 100).toLocaleString("fr-FR")} % du chiffre d'affaires en micro-entreprise`
  const infos = [`Profession : ${a.profession.libelle}, ${a.profession.caisse ? `caisse ${a.profession.caisse}` : "caisse pas encore prise en compte (calcul d'une profession non réglementée)"}${taux}.`]
  if (caisse && caisse.priseEnCharge.maladie + caisse.priseEnCharge.asv > 0) infos.push(`Pris en charge par l'Assurance maladie (part conventionnée ${arrondir(caisse.partConventionnee * 100)} %), hors des cotisations : maladie ${arrondir(caisse.priseEnCharge.maladie)} €, ASV ${arrondir(caisse.priseEnCharge.asv)} €.`)
  const base = caisse?.baseDesCotisationsDeLAnneePrecedente
  if (base) infos.push(`Retraite complémentaire et ASV de la CARPIMKO calculées sur l'assiette ${base.annee} (${arrondir(base.assiette)} €)${base.anneePrecedenteConnue ? ", celle de l'année précédente" : `, faute de l'année ${base.annee - 1} dans la simulation`}.`)
  return infos
}

function lignesBulletin(titre: string, bulletin: DetailCotisationsSalarie): Ligne {
  const composantes = (Object.keys(LIBELLES_REGIME_GENERAL) as CotisationSalarie[]).map(cle => composante(`${LIBELLES_REGIME_GENERAL[cle]} (salariale + patronale)`, bulletin.cotisations[cle].salariale + bulletin.cotisations[cle].patronale))
  return ligne(`${titre} : brut ${arrondir(bulletin.brut)} €, net ${arrondir(bulletin.net)} €, coût employeur ${arrondir(bulletin.coutEmployeur)} €`, bulletin.totalSalarial + bulletin.totalPatronal - bulletin.reductionGenerale, [...composantes, composante("Réduction générale (en moins)", -bulletin.reductionGenerale)])
}

/** Les réserves d'une société à l'IS sur l'année, en une phrase (voir l'ADR 014). */
function phraseDesReserves(r: ReservesDeLaSociete): string {
  const deficit = r.aLaFin.deficitReportable > 0 ? ` Déficit reportable sur l'impôt sur les sociétés des années suivantes : ${arrondir(r.aLaFin.deficitReportable)} €.` : ""
  const impute = r.deficitImpute > 0 ? ` Déficit des années précédentes déduit avant l'impôt sur les sociétés : ${arrondir(r.deficitImpute)} €.` : ""
  return `Réserves distribuables : ${arrondir(r.auDebut.reserves)} € au 1er janvier, ${arrondir(r.aLaFin.reserves)} € au 31 décembre ; bénéfice distribuable de l'année ${arrondir(r.beneficeDistribuableDeLAnnee)} € (après ${arrondir(r.dotationReserveLegale)} € de réserve légale), dividendes pris sur les réserves ${arrondir(r.dividendesPrisSurLesReserves)} €. Réserve légale : ${arrondir(r.aLaFin.reserveLegale)} €.${impute}${deficit}`
}

function informationsDeLActivite(session: SessionState, a: ActivityResult): string[] {
  const infos: string[] = []
  const vl = a.versementLiberatoire
  if (vl) infos.push(`Versement libératoire ${vl.applique ? "appliqué" : "non appliqué"} : revenu fiscal de référence ${vl.anneeRfr} ${vl.rfrN2 === null ? "inconnu" : `de ${arrondir(vl.rfrN2)} € (${vl.origineRfr})`}, plafond ${arrondir(vl.plafondRfr)} € pour ${vl.partsFiscales} part(s).`)
  if (a.acre) infos.push(`ACRE : réduction de ${a.acre.reduction * 100} % du ${a.acre.debut} au ${a.acre.fin}, ${arrondir(a.acre.economie)} € de cotisations économisées cette année.`)
  if (a.fraisDeDeplacement) infos.push(`Déplacements professionnels : ${a.fraisDeDeplacement.kilometres} km, ${arrondir(a.fraisDeDeplacement.montant)} € au barème kilométrique, ${a.fraisDeDeplacement.deductible ? "déductibles" : "non déductibles en micro-entreprise"}.`)
  if (a.sortieDuRegimeMicro) infos.push(`Sortie du régime micro depuis le 1er janvier ${a.sortieDuRegimeMicro.depuis} (plafonds dépassés en ${a.sortieDuRegimeMicro.depassements.join(" et ")}) : simulée en EI au réel.`)
  if (a.reserves) infos.push(phraseDesReserves(a.reserves))
  if (a.beneficiaireIds.length > 0) infos.push(`Revenus versés à : ${a.beneficiaireIds.map(id => nomDe(session, id)).join(", ")}.`)
  return [...informationsDeLaProfession(a), ...infos, ...(a.dispositifs ?? [])]
}

function expliquerActivite(session: SessionState, a: ActivityResult) {
  const cotisations: Ligne[] = [
    ...(a.cotisationsTNS ? [lignesTNS(a.cotisationsTNS)] : []),
    ...(a.formationProfessionnelle ? [ligne("dont contribution à la formation professionnelle (micro-entreprise, non réduite par l'ACRE)", a.formationProfessionnelle)] : []),
    ...(a.cotisationsPresident ? [lignesBulletin("Cotisations du président (assimilé salarié)", a.cotisationsPresident)] : []),
    ...(a.salaries ?? []).map(s => lignesBulletin(`Salarié ${nomDe(session, s.personId)}`, s))
  ]
  const p = a.partage
  const partage = p ? [ligne("Partage du bénéfice avant rémunération", p.beneficeAvantRemuneration, [composante("Rémunération nette", p.remunerationNette), composante("Cotisations sur la rémunération", p.cotisationsRemuneration), composante("Impôt sur les sociétés", p.impotSocietes), composante("Dividendes nets", p.dividendesNets), composante("Cotisations sur les dividendes", p.cotisationsSurDividendes), composante("Ajouté aux réserves (négatif : pris sur les réserves ou déficit)", p.resultatConserve)])] : []
  return {
    lignes: [ligne("Chiffre d'affaires", a.chiffreAffaires), ligne("Charges", a.charges), ligne("Cotisations sociales", a.cotisationsSociales), ...cotisations, ligne("Impôt sur les sociétés", a.impotSocietes), ligne("Revenu versé aux personnes, avant impôt sur le revenu", a.revenuVerse), ligne("Résultat conservé dans l'activité", a.resultatConserve), ...partage],
    informations: informationsDeLActivite(session, a),
    avertissements: a.warnings
  }
}

function expliquerPersonne(session: SessionState, rapport: SimulationReport, p: PersonResult) {
  const d = p.detail
  const revenus = ligne("Revenus de l'année, nets de cotisations", p.revenusDirects + p.revenusActivites, [composante("Salaires", d.salaires), composante("Allocations chômage", d.allocationsChomage), composante("Autres revenus", d.autresRevenus), composante("Rémunérations de dirigeant", d.remunerationsDirigeant), composante("Dividendes", d.dividendes), composante("Bénéfices", d.benefices)])
  const f = p.fraisProfessionnels
  const frais = f ? [ligne(`Frais professionnels retenus (${f.retenue === "reels" ? "frais réels" : `déduction forfaitaire de ${pourcent(f.tauxDeductionForfaitaire)}`})`, f.deduction, [composante("Déduction forfaitaire", f.deductionForfaitaire), composante("Frais réels", f.fraisReels), composante("dont trajets domicile-travail", f.fraisDeTrajet)])] : []
  const foyer = rapport.foyers.find(fo => fo.personIds.includes(p.entityId))
  const lignesFoyer = foyer ? [ligne(`Foyer fiscal (${foyer.personIds.map(id => nomDe(session, id)).join(", ")}, ${foyer.totalParts} ${foyer.totalParts > 1 ? "parts" : "part"}) : revenu imposable`, foyer.revenuImposableGlobal), ligne("Foyer : impôt sur le revenu", foyer.impotSurLeRevenu), ligne("Foyer : prélèvements sociaux", foyer.prelevementsSociaux), ligne("Foyer : net après impôts", foyer.netApresImpots)] : []
  return {
    lignes: [revenus, ligne("Cotisations salariales", p.cotisationsSalariales), ligne("Dépenses personnelles", p.depenses), ...frais, ...lignesFoyer],
    informations: foyer?.optionDividendes ? [`Dividendes imposés ${foyer.optionDividendes === "pfu" ? "au prélèvement forfaitaire unique" : "au barème"}, l'option la plus favorable au foyer.`] : [],
    avertissements: foyer?.warnings ?? []
  }
}

export const expliquerResultat = definirOutil({
  nom: "expliquer_resultat",
  titre: "Expliquer le résultat d'un acteur",
  description: [
    "Détaille, ligne à ligne, le résultat calculé par le moteur pour un acteur et une année.",
    "Activité : chiffre d'affaires, charges, cotisations (ligne à ligne pour un travailleur non salarié, un président de SASU ou un salarié, caisse d'un libéral réglementé), impôt sur les sociétés, partage du bénéfice, versement libératoire, ACRE, avertissements.",
    "Personne : revenus par nature, cotisations salariales, frais professionnels retenus, et l'impôt de son foyer fiscal.",
    "Montants annuels en euros, arrondis à l'euro. Pour répondre à « pourquoi ce montant ? » sans refaire le calcul."
  ].join(" "),
  lecture: true,
  parametres: z.strictObject({ acteurId: IdentifiantSchema.describe("Identifiant de l'acteur (voir decrire_simulation)."), annee: AnneeSchema.optional().describe("Année ; par défaut, la plus récente de la simulation.") }),
  resultat: z.object({ annee: z.number(), acteurId: z.string(), acteur: z.string(), genre: z.string(), lignes: z.array(LigneSchema), informations: z.array(z.string()), avertissements: z.array(z.string()) }),
  executer: (session, { acteurId, annee }) => {
    const acteur = trouverActeur(session, acteurId)
    const rapport = rapportDeLAnnee(session, annee)
    const entete = { annee: rapport.annee, acteurId, acteur: acteur.name, genre: genreDe(acteur) }
    const activite = rapport.activities.find(a => a.entityId === acteurId)
    if (activite) return resultatSeul({ ...entete, ...expliquerActivite(session, activite) })
    const personne = rapport.persons.find(p => p.entityId === acteurId)
    if (!personne) throw new ErreurOutil(`Le moteur n'a pas de résultat pour « ${acteur.name} » en ${rapport.annee}.`)
    return resultatSeul({ ...entete, ...expliquerPersonne(session, rapport, personne) })
  }
})
