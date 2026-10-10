// src/lib/simuler-en-ligne-de-commande.ts
// Commande `npm run simuler` (scripts/simuler.mjs) : lit un fichier de session, le passe dans le moteur et rend le
// résultat en texte pour le terminal, année par année, par activité et par foyer. La lecture (conversion d'un format
// précédent, validation par le schéma, nettoyage) et le calcul sont ceux de l'application ; ce module ne fait que
// choisir et mettre en forme. Sans accès au disque : le script lui donne la fonction de lecture.

import { AnneesRefuseesError, SessionIrrecuperableError } from "@/backend/logic/data-sanitizer"
import { lireLaSession } from "@/backend/logic/fichiers-de-donnees"
import { simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { euros } from "@/lib/export-markdown"
import type { ActivityResult, Entity, FoyerFiscalResult, ResultatAnnee, SanitizationReport, SessionState, SimulationReport } from "@/types"

export const AIDE = `Usage : npm run simuler -- <fichier.json> [--annee AAAA] [--acteur NOM] [--json]

Passe une session dans le moteur du simulateur et affiche, pour chaque année : l'année des règles appliquées,
les avertissements, les montants clés de chaque activité et de chaque foyer, puis le bilan de l'année.

  <fichier.json>   Session au format de l'application : export d'une sauvegarde, export complet ou
                   sessionState.json. Il est converti, validé et nettoyé comme à l'ouverture dans l'application.
  --annee AAAA     Seulement cette année de la session.
  --acteur NOM     Seulement ce qui concerne cet acteur (identifiant, nom, ou partie du nom qui ne désigne que
                   lui) : une personne, ses activités et son foyer ; une activité et les foyers de ses bénéficiaires.
  --json           Les rapports bruts du moteur, en JSON (avec --annee : cette année seulement).
  --aide, -h       Cette aide.`

/** Options de la commande. */
export interface OptionsDeSimuler {
  fichier: string
  annee?: number
  acteur?: string
  json: boolean
}

/** Résultat de la commande : le texte à afficher et le code de sortie (0 : succès, 1 : fichier refusé, 2 : usage). */
export interface SortieDeSimuler {
  code: 0 | 1 | 2
  texte: string
}

const erreurDUsage = (message: string): SortieDeSimuler => ({ code: 2, texte: `${message}\n\n${AIDE}` })

/** Lit les arguments de la commande ; `null` si l'aide est demandée. @throws {Error} Si un argument est invalide. */
export function lireLesArguments(args: string[]): OptionsDeSimuler | null {
  const options: Partial<OptionsDeSimuler> = { json: false }
  const valeurDe = (i: number, option: string) => {
    const valeur = args[i + 1]
    if (valeur === undefined || valeur.startsWith("--")) throw new Error(`L'option ${option} attend une valeur.`)
    return valeur
  }
  for (let i = 0; i < args.length; i++) {
    const argument = args[i]
    if (argument === "--aide" || argument === "-h" || argument === "--help") return null
    if (argument === "--json") options.json = true
    else if (argument === "--annee") {
      const annee = valeurDe(i++, argument)
      if (!/^\d{4}$/.test(annee)) throw new Error(`Année invalide : « ${annee} » (attendu : AAAA).`)
      options.annee = Number(annee)
    } else if (argument === "--acteur") options.acteur = valeurDe(i++, argument)
    else if (argument.startsWith("-")) throw new Error(`Option inconnue : ${argument}`)
    else if (options.fichier === undefined) options.fichier = argument
    else throw new Error(`Un seul fichier à la fois (reçu aussi « ${argument} »).`)
  }
  if (options.fichier === undefined) throw new Error("Indiquez le fichier de la session.")
  return options as OptionsDeSimuler
}

// --- Mise en forme ---

const LARGEUR_DU_LIBELLE = 30

/** Une ligne « libellé ……… montant », montants alignés à droite. */
const ligne = (libelle: string, valeur: number | string) =>
  `    ${libelle.padEnd(LARGEUR_DU_LIBELLE)}${(typeof valeur === "number" ? euros(valeur) : valeur).padStart(14)}`

const avertissements = (liste: string[], retrait: string) => liste.map(a => `${retrait}! ${a}`)

function lignesDeLActivite(activite: ActivityResult): string[] {
  const lignes = [
    `  ${activite.name} (${activite.statut})`,
    ligne("Chiffre d'affaires", activite.chiffreAffaires),
    ligne(activite.type === "micro-entreprise" ? "Dépenses" : "Charges", activite.charges),
    ligne("Cotisations sociales", activite.cotisationsSociales)
  ]
  if (activite.cotisationsTNS) lignes.push(ligne("  dont TNS (assiette)", activite.cotisationsTNS.assiette))
  if (activite.cotisationsPresident) {
    const president = activite.cotisationsPresident
    lignes.push(ligne("  président : brut", president.brut), ligne("  président : net", president.net), ligne("  président : coût", president.coutEmployeur))
  }
  const societeALIS = activite.partage !== undefined || activite.impotSocietes !== 0
  if (societeALIS) lignes.push(ligne("Impôt sur les sociétés", activite.impotSocietes))
  lignes.push(ligne("Revenu versé", activite.revenuVerse))
  if (societeALIS) lignes.push(ligne("Résultat conservé", activite.resultatConserve))
  if (activite.versementLiberatoire) lignes.push(ligne("Versement libératoire", activite.versementLiberatoire.applique ? "appliqué" : "non appliqué"))
  return [...lignes, ...(activite.dispositifs ?? []).map(d => `    · ${d}`), ...avertissements(activite.warnings, "    ")]
}

function lignesDuFoyer(foyer: FoyerFiscalResult, report: SimulationReport): string[] {
  const noms = foyer.personIds.map(id => report.persons.find(p => p.entityId === id)?.name ?? id)
  const parts = `${foyer.totalParts.toLocaleString("fr-FR")} part${foyer.totalParts > 1 ? "s" : ""}`
  const dividendes = { pfu: "prélèvement forfaitaire", bareme: "barème" } as const
  return [
    `  ${noms.join(", ")} (${parts})`,
    ligne("Revenus encaissés", foyer.revenusEncaisses),
    ligne("Revenu imposable", foyer.revenuImposableGlobal),
    ligne("Revenu fiscal de référence", foyer.revenuFiscalDeReference),
    ligne("Impôt sur le revenu", foyer.impotSurLeRevenu),
    ligne("Prélèvements sociaux", foyer.prelevementsSociaux),
    ...(foyer.optionDividendes ? [ligne("Dividendes imposés au", dividendes[foyer.optionDividendes])] : []),
    ligne("Net après impôts", foyer.netApresImpots),
    ...avertissements(foyer.warnings, "    ")
  ]
}

function lignesDuBilan(report: SimulationReport): string[] {
  const { bilan } = report
  return [
    "Bilan de l'année",
    ligne("Chiffre d'affaires", bilan.chiffreAffaires),
    ligne("Revenus avant prélèvements", bilan.revenusAvantPrelevements),
    ligne("Total des prélèvements", bilan.totalPrelevements),
    ligne("Résultat conservé", bilan.resultatConserve),
    ligne("Net après impôts (foyers)", report.totalNetApresImpots),
    ...(bilan.nonRattache !== 0 ? [ligne("Non rattaché à une personne", bilan.nonRattache)] : [])
  ]
}

/** Ce que l'on garde d'une année quand un acteur est choisi : ses activités et les foyers concernés. */
function selection(report: SimulationReport, acteur: Entity | undefined) {
  if (!acteur) return { activites: report.activities, foyers: report.foyers }
  const activites = report.activities.filter(a => a.entityId === acteur.id || (acteur.type === "person" && a.beneficiaireIds.includes(acteur.id)))
  const personnes = acteur.type === "person" ? [acteur.id] : activites.flatMap(a => a.beneficiaireIds)
  return { activites, foyers: report.foyers.filter(f => f.personIds.some(id => personnes.includes(id))) }
}

function lignesDeLAnnee({ annee, report, erreur }: ResultatAnnee, acteur: Entity | undefined): string[] {
  if (!report) return [`== ${annee} : non simulée ==`, `  ${erreur ?? ""}`]
  const regles = report.anneeDesRegles === annee ? `règles de ${annee}` : `règles de ${report.anneeDesRegles}, les dernières connues`
  const { activites, foyers } = selection(report, acteur)
  return [
    `== ${annee} (${regles}) ==`,
    ...avertissements(report.avertissements, "  "),
    "",
    "Activités",
    ...(activites.length > 0 ? activites.flatMap(lignesDeLActivite) : ["  (aucune)"]),
    "",
    "Foyers",
    ...(foyers.length > 0 ? foyers.flatMap(f => lignesDuFoyer(f, report)) : ["  (aucun)"]),
    ...(acteur ? [] : ["", ...lignesDuBilan(report)])
  ]
}

/** Ce que le nettoyage a retiré ou converti, en une ligne par point ; rien si le fichier était propre. */
function lignesDuNettoyage(report: SanitizationReport, versionOrigine: number): string[] {
  const retraits = [
    [report.entitiesRemoved, "acteur(s)"],
    [report.relationshipsRemoved, "relation(s)"],
    [report.flowsRemoved, "flux"],
    [report.reglagesRemoved, "réglage(s) du comparateur"],
    [report.professionsRemoved, "profession(s) inconnue(s)"]
  ] as const
  const ecartes = retraits.filter(([n]) => n > 0).map(([n, quoi]) => `${n} ${quoi}`)
  return [
    ...(ecartes.length > 0 ? [`Nettoyage : écartés ${ecartes.join(", ")}.`] : []),
    ...(report.anneesEcartees.length > 0 ? [`Nettoyage : années en double écartées ${report.anneesEcartees.join(", ")}.`] : []),
    ...report.migrationNotes.map(note => `Conversion depuis le format ${versionOrigine} : ${note}`)
  ]
}

/**
 * Trouve l'acteur par identifiant, par nom, ou par une partie de son nom qui ne désigne que lui, sans tenir compte de
 * la casse. @throws {Error} S'il est introuvable ou si plusieurs acteurs répondent.
 */
function acteurDe(session: SessionState, recherche: string): Entity {
  const cherche = recherche.toLowerCase()
  const exact = session.entities.find(e => e.id === recherche) ?? session.entities.find(e => e.name.toLowerCase() === cherche)
  if (exact) return exact
  const candidats = session.entities.filter(e => e.name.toLowerCase().includes(cherche))
  if (candidats.length === 1) return candidats[0]
  const noms = (acteurs: Entity[]) => acteurs.map(e => e.name).join(", ")
  if (candidats.length > 1) throw new Error(`Plusieurs acteurs répondent à « ${recherche} » : ${noms(candidats)}. Précisez le nom.`)
  throw new Error(`Acteur introuvable : « ${recherche} ». Acteurs de la session : ${noms(session.entities)}.`)
}

/** Message d'un fichier qui ne peut pas être simulé : absent, illisible ou refusé à la lecture. */
export function messageDErreurDuFichier(fichier: string, erreur: unknown): string {
  const code = (erreur as { code?: unknown } | null)?.code
  if (code === "ENOENT") return `Fichier introuvable : ${fichier}`
  if (typeof code === "string") return `Fichier illisible : ${fichier} (${code}).`
  if (erreur instanceof SyntaxError) return `Fichier illisible : ${fichier} n'est pas du JSON valide (${erreur.message}).`
  if (erreur instanceof SessionIrrecuperableError) return `Fichier refusé : ${fichier}. ${erreur.message}`
  if (erreur instanceof AnneesRefuseesError) return `Fichier refusé : ${fichier}. ${erreur.message}`
  throw erreur
}

/**
 * La commande entière : arguments, lecture du fichier par `lire`, nettoyage, calcul de toutes les années (une année
 * hérite des précédentes, même si une seule est affichée), puis texte ou JSON.
 */
export function executerSimuler(args: string[], lire: (chemin: string) => string): SortieDeSimuler {
  let options: OptionsDeSimuler | null
  try {
    options = lireLesArguments(args)
  } catch (erreur) {
    return erreurDUsage((erreur as Error).message)
  }
  if (!options) return { code: 0, texte: AIDE }
  let lu: ReturnType<typeof lireLaSession>
  try {
    lu = lireLaSession(lire(options.fichier))
  } catch (erreur) {
    return { code: 1, texte: messageDErreurDuFichier(options.fichier, erreur) }
  }
  const { safeState: session, report: nettoyage, versionOrigine } = lu
  const { annee, acteur: recherche } = options
  if (annee !== undefined && !session.annees.some(a => a.annee === annee)) {
    return { code: 2, texte: `L'année ${annee} n'est pas dans la session (années : ${session.annees.map(a => a.annee).join(", ")}).` }
  }
  let acteur: Entity | undefined
  try {
    acteur = recherche === undefined ? undefined : acteurDe(session, recherche)
  } catch (erreur) {
    return { code: 2, texte: (erreur as Error).message }
  }
  if (acteur && options.json) return erreurDUsage("--acteur ne se combine pas avec --json, qui rend les rapports entiers.")
  const annees = simulerLesAnnees(session).annees.filter(r => annee === undefined || r.annee === annee)
  if (options.json) return { code: 0, texte: JSON.stringify({ annees }, null, 2) }
  const entete = [`Simulation « ${session.name} » : ${options.fichier}`, ...lignesDuNettoyage(nettoyage, versionOrigine)]
  if (acteur) entete.push(`Acteur : ${acteur.name}`)
  return { code: 0, texte: [...entete, "", ...annees.flatMap(r => [...lignesDeLAnnee(r, acteur), ""])].join("\n").trimEnd() }
}
