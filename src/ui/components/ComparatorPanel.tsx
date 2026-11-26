// src/ui/components/ComparatorPanel.tsx

import { useCallback, useEffect, useMemo, type MouseEvent, type ReactNode } from "react"
import { ArrowDown, Ban, Crown, HeartHandshake } from "lucide-react"
import { useOptimisation } from "../hooks/useOptimisation"
import { appliquerRemuneration, avecActiviteComparee, avecRemunerationSaisie, avecReglagesDeLActivite, comparableActivities, partBncUtile, plafondDeRemuneration, reglagesDeLActiviteComparee, retenirLesReglages } from "@/lib/comparateur-options"
import { numeroterNotes } from "@/lib/notes"
import { vueDeLAnnee } from "@/backend/logic/annees"
import { ECART_NEGLIGEABLE, PART_MISE_EN_RESERVE_PAR_DEFAUT } from "@/backend/logic/options-du-comparateur"
import { cn } from "@/lib/utils"
import { exporterComparaisonCsv } from "../exports-texte"
import { BoutonExportCsv } from "./BoutonExportCsv"
import { CombienFacturer } from "./CombienFacturer"
import { ProtectionDesStatuts } from "./ProtectionDesStatuts"
import { ChoixDuStatut, RemunerationOptimizer } from "./RemunerationOptimizer"
import { RepartitionDuBenefice } from "./RepartitionBenefice"
import { SurToutesLesAnnees } from "./SurToutesLesAnnees"
import { ChoixDeLActivite, ID_DU_CHOIX_DE_L_ACTIVITE, ReglagesCommuns, ReglagesDeLaSociete, type PlafondsDeRemuneration } from "./ReglagesDuComparateur"
import { comportementDuDefilement } from "../hooks/useDefilementHorizontal"
import { ColonnesTouchees, EtapeDuComparateur } from "./EtapeDuComparateur"
import { ZoneDefilante } from "./ZoneDefilante"
import { BoutonDuDetail, CartesDesStatuts, EcartDeFraisDeLaColonne, EcartDeRepartitionDeLaColonne, RappelDesFrais, RappelDuBeneficeGarde, ResteDansLActivite, SituationTelleQueSaisie, VerdictDuComparateur } from "./SyntheseDuComparateur"
import { ReplieEnResume } from "./ReplieEnResume"
import { Depliable } from "./Depliable"
import { BullesDesNotes, NotesDuTableau, RenvoisAuxNotes } from "./NotesDuComparateur"
import { useAffichageResume } from "../hooks/useAffichage"
import { useCalculDiffere } from "../hooks/useCalculDiffere"
import { useSectionOuverte } from "../hooks/useSectionOuverte"
import { ANCRES, lienVers } from "@/lib/ancres"
import { avecUnePerteConservee, avertissementsSansLeVerdict, ecartAvecLaSituationSaisie, estNonRetenue, libelleDuCoutDesTrimestres, netDeLaSituationSaisie, raisonDeNonRetenue, type ResumeDeLaComparaison } from "@/lib/resume"
import { estSocieteIS, STATUTS_SOCIETE, type ComparaisonCouple, type ComparaisonOptions, type ComparaisonResult, type Comparateur, type Company, type MicroEntreprise, type OptimisationRemuneration, type ReglagesComparateur, type ScenarioStatut, type SessionState, type SimulationAnnuelle, type StatutCompare, type StatutSociete } from "@/types"
import { COLONNE_FIXE } from "../colonne-fixe"
import { ligneAlternee } from "../lignes-alternees"
import { ecartSigne, euros } from "@/backend/logic/format"
import { netCompare } from "@/backend/logic/net-compare"

/** Colonne non retenue : grisée et hachurée (`colonne-non-retenue`, App.css), la cellule de l'écart dit pourquoi. */
const GRISE = "colonne-non-retenue bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400"

/** Fond de l'en-tête du tableau, rendu opaque pour sa première cellule, fixe : le gris translucide sur le fond de la page. */
const FOND_DE_L_EN_TETE = "bg-slate-100 dark:bg-[color-mix(in_oklab,var(--color-slate-800)_80%,var(--background))]"

/**
 * Largeurs minimales des colonnes, données à leur case d'en-tête : sans elles, le tableau serre ses colonnes jusqu'à la
 * largeur d'un mot avant de défiler, et une note d'écart de frais s'écrit sur neuf lignes. Le tableau défile donc plus
 * tôt, chaque colonne restant lisible. Sur un téléphone étroit (moins de 480 px), un minimum plus petit pour les statuts,
 * et aucun pour les libellés (la largeur de leur plus long mot), laissent voir le libellé et un peu plus d'une colonne de
 * statut : on comprend que le tableau défile. Sur papier, rien ne défile : le tableau tient dans la largeur de la feuille.
 */
const LARGEUR_DES_LIBELLES = "min-w-36 max-[30rem]:min-w-0 print:min-w-0"
const LARGEUR_D_UN_STATUT = "min-w-40 max-[30rem]:min-w-34 print:min-w-0"

/**
 * Colonne au meilleur net : bords émeraude de 2 px et halo sur les côtés (au-dessus des colonnes voisines, sous la
 * colonne fixe des libellés). Le halo s'allume une fois quand la colonne le devient, sauf si le système demande moins
 * d'animations ; sur papier, le cadre seul.
 */
const CADRE_DU_MEILLEUR = "relative z-[1] border-x-2 border-x-emerald-500 shadow-[-8px_0_14px_-8px_rgb(16_185_129/0.55),8px_0_14px_-8px_rgb(16_185_129/0.55)] motion-safe:animate-lueur dark:border-x-emerald-400 print:shadow-none"

/** Bas du cadre : sur la dernière ligne affichée ; « ecran » quand d'autres lignes la suivent sur papier. */
type BasDuCadre = "non" | "oui" | "ecran"

/** Cadre d'une cellule de la colonne au meilleur net ; rien pour les autres colonnes. */
function cadreDuMeilleur(s: ScenarioStatut, meilleur: ComparaisonResult["meilleur"], bas: BasDuCadre = "non"): string | undefined {
  if (s.statut !== meilleur) return undefined
  return cn(CADRE_DU_MEILLEUR, bas !== "non" && "border-b-2 border-b-emerald-500 dark:border-b-emerald-400", bas === "ecran" && "print:border-b-0")
}

/** Libellé d'une ligne, dans la colonne fixe. */
const LIBELLE_DE_LIGNE = cn(COLONNE_FIXE, "bg-background px-3 py-2 text-left font-normal text-slate-600 dark:text-slate-300")

/** Activité que le comparateur peut étudier : une société ou une micro-entreprise. */
type ActiviteComparable = Company | MicroEntreprise

export interface ComparatorPanelProps {
  session: SessionState
  /** Année comparée : celle qui est affichée. */
  annee: number
  /** Enregistre dans la session les réglages du comparateur, à partir des réglages actuels. */
  onComparateurChange: (modifier: (comparateur: Comparateur | undefined) => Comparateur) => void
  /** Reçoit l'activité comparée et le résultat à chaque nouvelle comparaison (barre de résumé de l'affichage « Résumé »). */
  onComparaison?: (resume: ResumeDeLaComparaison | null) => void
}

/** Sans activité, on compare tout de même les couples en union libre. */
const NO_ACTIVITY: ComparaisonOptions = { activityId: "", remunerationNette: 0, repartition: { mode: "dividendes", partDistribuee: 1 }, partBncPrestations: 1 }

/** Couleur d'un écart : vert s'il est favorable, rouge sinon. */
function deltaClass(delta: number): string | undefined {
  if (delta > 0) return "text-emerald-700 dark:text-emerald-400"
  if (delta < 0) return "text-rose-700 dark:text-rose-400"
  return undefined
}

function rate(scenario: ScenarioStatut): string {
  if (scenario.revenusAvantPrelevements <= 0) return "—"
  return (scenario.totalPrelevements / scenario.revenusAvantPrelevements).toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 })
}

/** Écart de frais de gestion d'une colonne avec le statut actuel : « +2 050 € », « −850 € », « — » s'il n'y en a pas. */
const ecartDeFrais = (s: ScenarioStatut) => (Math.round(s.ecartDeFrais.total) === 0 ? "—" : ecartSigne(s.ecartDeFrais.total))

/**
 * Lignes du tableau : libellé et valeur d'une colonne, et ce que la cellule précise dessous (sous le net : la perte
 * restée dans la société ou le bénéfice qu'elle garde, l'écart de frais de gestion). Les deux dernières portent sur l'activité comparée ; la toute
 * dernière, le net une fois la perte déduite, n'existe que si une perte est déduite quelque part.
 */
const rows = (activityName: string, actuel: StatutCompare | undefined, avecPerte: boolean): { label: string; value: (s: ScenarioStatut) => string; detail?: (s: ScenarioStatut) => ReactNode; strong?: boolean }[] => [
  {
    label: "Net dans la poche",
    value: s => euros(s.netApresImpots),
    detail: s => (
      <>
        <EcartDeFraisDeLaColonne scenario={s} actuel={actuel} />
        <ResteDansLActivite scenario={s} />
      </>
    ),
    strong: true
  },
  { label: "Taux global de prélèvement", value: rate },
  { label: "Frais de gestion par rapport au statut actuel", value: ecartDeFrais },
  { label: "Cotisations sociales", value: s => euros(s.cotisationsSociales) },
  { label: "Impôt sur les sociétés", value: s => euros(s.impotSocietes) },
  { label: "Impôt sur le revenu", value: s => euros(s.impotSurLeRevenu) },
  { label: "Prélèvements sociaux", value: s => euros(s.prelevementsSociaux) },
  { label: `Conservé dans « ${activityName} »`, value: s => euros(s.resultatConserveActivite) },
  ...(avecPerte ? [{ label: "Net, perte restée dans l'activité déduite", value: (s: ScenarioStatut) => euros(netCompare(s)) }] : [])
]

/** Étoiles pleines et vides, sur 5. */
function stars(count: number): string {
  return "★".repeat(count) + "☆".repeat(5 - count)
}

/** Au meilleur net, la rémunération retenue dans la colonne : « rémunération optimale : 12 300 € nets ». */
function RemunerationRetenue({ scenario }: { scenario: ScenarioStatut }) {
  const retenue = scenario.remunerationOptimale
  if (!retenue) return null
  return (
    <span className="mt-1 block text-xs font-normal text-slate-700 dark:text-slate-200">
      {scenario.saisieAuMeilleurNet ? (
        // La répartition saisie fait aussi bien que l'arbitrage, à un écart négligeable près : la colonne la garde.
        <>
          votre répartition, <span className="whitespace-nowrap">au meilleur net</span> à moins de <span className="whitespace-nowrap">{euros(ECART_NEGLIGEABLE)}</span> près
        </>
      ) : (
        <>
          rémunération optimale : <span className="whitespace-nowrap font-medium">{euros(retenue.remunerationNette)} nets</span>
        </>
      )}
      {retenue.avecRetraite ? <span className="block text-slate-600 dark:text-slate-400">avec 4 trimestres de retraite</span> : null}
      {retenue.retraiteHorsDAtteinte ? <span className="block text-amber-800 dark:text-amber-300">4 trimestres hors d'atteinte</span> : null}
      {/* Cochée ou non, ce que coûtent les 4 trimestres dans cette colonne : le choix se fait en connaissance de cause. */}
      {retenue.coutDesQuatreTrimestres ? <span className="block text-slate-600 dark:text-slate-400">{libelleDuCoutDesTrimestres(retenue.coutDesQuatreTrimestres)}</span> : null}
    </span>
  )
}

/**
 * Colonne micro au-delà des plafonds : tenable deux ans au plus ; ou régime déjà fermé à l'activité, sortie du régime
 * micro après deux années de suite au-delà des plafonds. Jamais désignée meilleur net.
 */
function MentionDuPlafond({ scenario }: { scenario: ScenarioStatut }) {
  const classe = "block text-xs font-medium text-amber-800 dark:text-amber-300"
  if (scenario.regimeMicroFerme) return <span className={classe}>plus accessible · sortie au 1er janvier {scenario.regimeMicroFerme.depuis}</span>
  return scenario.horsPlafond ? <span className={classe}>hors plafond · 2 ans au plus</span> : null
}

/**
 * Colonne d'une société dont la rémunération choisie dépassait ce qu'elle peut verser : la colonne en retient moins,
 * et l'en-tête le dit, comme pour le déficit ci-dessous.
 */
function MentionDeLaRemunerationLimitee({ scenario }: { scenario: ScenarioStatut }) {
  const plafond = scenario.remunerationPlafonnee
  if (!plafond) return null
  return <span className="block text-xs font-medium text-amber-800 dark:text-amber-300">{plafond.retenue > 0 ? <>rémunération limitée à <span className="whitespace-nowrap">{euros(plafond.retenue)}</span></> : "aucune rémunération possible"}</span>
}

/**
 * Colonne d'une société déficitaire (une année de perte, ou une rémunération de la grille supérieure au bénéfice).
 * L'en-tête le dit : la note qui le détaille peut être réduite à une pastille (affichage « Résumé »), et une alerte ne
 * doit pas attendre un clic.
 */
function MentionDuDeficit({ scenario }: { scenario: ScenarioStatut }) {
  if (!scenario.partage || scenario.partage.resultatConserve >= 0) return null
  return <span className="block text-xs font-medium text-amber-800 dark:text-amber-300">société déficitaire</span>
}

/** Pastille de la colonne au meilleur net, avec une couronne : le seul élément vif de l'onglet, il désigne la réponse. */
function PastilleDuMeilleur() {
  return (
    <span className="mb-1.5 flex justify-end">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_0_12px_rgb(16_185_129/0.6)] dark:bg-emerald-400 dark:text-emerald-950 print:shadow-none">
        <Crown aria-hidden="true" className="size-3.5" />
        Meilleur net
      </span>
    </span>
  )
}

/** La pastille d'une colonne jamais désignée meilleur statut, à la place de « Meilleur net » : elle se lit avant le montant. */
function PastilleNonRetenue() {
  return (
    <span className="mb-1.5 flex justify-end">
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-500 bg-slate-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-800 dark:border-slate-400 dark:bg-slate-700 dark:text-slate-100">
        <Ban aria-hidden="true" className="size-3.5" />
        non retenue
      </span>
    </span>
  )
}

/** Dans l'en-tête d'une colonne SASU ou EURL, le lien vers l'étape 3, où se règle le partage de son bénéfice. */
/**
 * Descend en douceur au titre de l'étape 3 (instantané si le système demande moins d'animations), lui donne le focus
 * et met l'ancre dans l'adresse, comme le lien l'aurait fait. Un clic avec Ctrl, Maj ou la molette garde le
 * comportement du navigateur (nouvel onglet, nouvelle fenêtre).
 */
function descendreAuReglage(evenement: MouseEvent<HTMLAnchorElement>) {
  const titre = document.getElementById(ANCRES.reglageDeLaSociete)
  if (!titre || evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey || evenement.altKey) return
  evenement.preventDefault()
  window.history.pushState(window.history.state, "", lienVers(ANCRES.reglageDeLaSociete))
  titre.scrollIntoView({ block: "start", behavior: comportementDuDefilement() })
  titre.focus({ preventScroll: true })
}

function LienVersLeReglage({ statut }: { statut: StatutCompare }) {
  if (!estSocieteIS(statut)) return null
  return (
    <a href={lienVers(ANCRES.reglageDeLaSociete)} onClick={descendreAuReglage} className="mt-1 inline-flex min-h-6 items-center gap-0.5 rounded-sm text-xs font-medium text-blue-700 underline-offset-2 hover:underline pointer-coarse:min-h-11 dark:text-blue-400 print:hidden">
      <ArrowDown aria-hidden="true" className="size-3" />
      régler à l'étape 3<span className="sr-only"> : partage du bénéfice en {statut}</span>
    </a>
  )
}

/**
 * En-tête d'une colonne : la pastille « Meilleur net », le statut, ses mentions (actuel : la situation saisie, au net
 * des résultats) et les pastilles de ses notes (un clic ouvre la note dans une bulle). Une colonne non retenue est
 * grisée. Une colonne de société mène à l'étape 3, où se règle le partage de son bénéfice.
 */
function EnTeteDeStatut({ scenario, meilleur, renvois }: { scenario: ScenarioStatut; meilleur: boolean; renvois: number[] }) {
  // « non retenue » se lit dès l'en-tête, dans une pastille, comme « Meilleur net » : le fond grisé et hachuré ne le
  // dit pas à lui seul. La cellule de l'écart dit pourquoi.
  const mentions = scenario.telleQueSaisie ? "actuel" : ""
  return (
    <th scope="col" data-meilleur={meilleur || undefined} className={cn(LARGEUR_D_UN_STATUT, "px-3 py-2 text-right align-top font-medium text-slate-700 dark:text-slate-200", meilleur && "border-t-2 border-t-emerald-500 bg-emerald-100 dark:border-t-emerald-400 dark:bg-emerald-900/40", meilleur && CADRE_DU_MEILLEUR, estNonRetenue(scenario) && GRISE)}>
      {meilleur ? <PastilleDuMeilleur /> : null}
      {!meilleur && estNonRetenue(scenario) ? <PastilleNonRetenue /> : null}
      {scenario.libelle}
      <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">{mentions || " "}</span>
      <RemunerationRetenue scenario={scenario} />
      <MentionDuPlafond scenario={scenario} />
      <MentionDeLaRemunerationLimitee scenario={scenario} />
      <MentionDuDeficit scenario={scenario} />
      <RenvoisAuxNotes colonne={scenario.statut} renvois={renvois} />
      <LienVersLeReglage statut={scenario.statut} />
    </th>
  )
}

/** Fond d'une cellule de colonne : vert pour le meilleur net, gris pour une colonne micro non retenue. */
function fondDeLaCellule(s: ScenarioStatut, meilleur: ComparaisonResult["meilleur"]): string | undefined {
  if (s.statut === meilleur) return "bg-emerald-50 dark:bg-emerald-950/30"
  return estNonRetenue(s) ? GRISE : undefined
}

/**
 * Écart du net de chaque colonne avec la situation telle que saisie (le net des résultats). Une colonne micro non
 * retenue n'est pas colorée : la cellule dit pourquoi elle ne l'est pas.
 */
function LigneDeLEcart({ result, rang, bas }: { result: ComparaisonResult; rang: number; bas: BasDuCadre }) {
  if (netDeLaSituationSaisie(result) === null) return null
  return (
    <tr className={cn("border-t border-slate-200 align-top dark:border-slate-700", ligneAlternee(rang))}>
      <th scope="row" className={LIBELLE_DE_LIGNE}>
        Écart avec votre situation actuelle
      </th>
      {result.scenarios.map(s => {
        const ecart = ecartAvecLaSituationSaisie(result, s)
        const raison = raisonDeNonRetenue(s)
        return (
          <td key={s.statut} className={cn("px-3 py-2 text-right tabular-nums", ecart !== null && !raison && deltaClass(ecart), fondDeLaCellule(s, result.meilleur), cadreDuMeilleur(s, result.meilleur, bas))}>
            {ecart === null ? "—" : ecartSigne(ecart)}
            <EcartDeRepartitionDeLaColonne result={result} scenario={s} />
            {raison ? <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">{raison}</span> : null}
          </td>
        )
      })}
    </tr>
  )
}

interface ComparisonTableProps {
  result: ComparaisonResult
  activityName: string
  renvois: Map<string, number[]>
  /** Affichage « Résumé » : net, écart et protection d'abord ; les autres lignes ne s'affichent qu'à la demande (et à l'impression). */
  reduit?: boolean
  detailOuvert?: boolean
  className?: string
}

function ComparisonTable({ result, activityName, renvois, reduit = false, detailOuvert = false, className }: ComparisonTableProps) {
  if (result.scenarios.length === 0) return null
  const fond = (s: ScenarioStatut, bas: BasDuCadre = "non") => cn(fondDeLaCellule(s, result.meilleur), cadreDuMeilleur(s, result.meilleur, bas))

  // Rang de chaque ligne dans l'ordre affiché, pour les lignes alternées : l'affichage « Résumé » remonte l'écart et la
  // protection sociale sous la première ligne. Les cases sont alignées en haut : d'une colonne à l'autre, les montants
  // restent sur la même ligne, et la note à déplier d'une colonne (écart de frais de gestion) vient dessous.
  const avecEcart = netDeLaSituationSaisie(result) !== null
  const ligne = (row: ReturnType<typeof rows>[number], rang: number, bas: BasDuCadre = "non") => (
    <tr key={row.label} className={cn("border-t border-slate-200 align-top dark:border-slate-700", ligneAlternee(rang))}>
      <th scope="row" className={LIBELLE_DE_LIGNE}>
        {row.label}
      </th>
      {result.scenarios.map(s => (
        <td key={s.statut} className={cn("px-3 py-2 text-right tabular-nums", row.strong && "font-semibold", fond(s, bas))}>
          {row.value(s)}
          {row.detail?.(s)}
        </td>
      ))}
    </tr>
  )
  const lignes = rows(activityName, result.situationSaisie?.statut, avecUnePerteConservee(result))
  const protection = (rang: number, bas: BasDuCadre) => (
    <tr className={cn("border-t border-slate-200 align-top dark:border-slate-700", ligneAlternee(rang))}>
      <th scope="row" className={LIBELLE_DE_LIGNE}>
        Protection sociale
      </th>
      {result.scenarios.map(s => (
        <td key={s.statut} className={cn("px-3 py-2 text-right", fond(s, bas))} title={s.protectionSociale.resume}>
          <span aria-hidden="true" className="tracking-wider text-amber-500">
            {stars(s.protectionSociale.etoiles)}
          </span>
          <span className="sr-only">{s.protectionSociale.etoiles} sur 5</span>
          <span className="block text-xs text-slate-600 dark:text-slate-400">{s.protectionSociale.trimestres} trim. retraite</span>
        </td>
      ))}
    </tr>
  )
  const ecart = (rang: number, bas: BasDuCadre) => <LigneDeLEcart result={result} rang={rang} bas={bas} />
  const apresLEcart = avecEcart ? 2 : 1
  const detail = lignes.slice(1)
  return (
    // Dans une fenêtre étroite, la colonne au meilleur net (la réponse) peut être hors de l'écran : la zone la montre à
    // sa première apparition.
    <ZoneDefilante libelle="Tableau de comparaison" montrerAuPremierAffichage="[data-meilleur]" className={cn("rounded-lg border border-slate-200 dark:border-slate-700", className)}>
      {/* Sur papier, une ligne porte le détail de chaque case (frais poste par poste, partage du bénéfice) : haute
          d'une demi-page ou plus, elle peut se couper entre deux pages, au lieu de partir entière et de laisser une page
          presque vide sous l'en-tête. */}
      <table data-lignes-secables className="w-full min-w-[48rem] text-sm print:min-w-0 print:text-[8pt]" aria-label="Comparaison des statuts">
        <thead className="bg-slate-100 dark:bg-slate-800/80">
          <tr>
            <th scope="col" className={cn(COLONNE_FIXE, FOND_DE_L_EN_TETE, LARGEUR_DES_LIBELLES, "px-3 py-2 text-left")}>
              <span className="sr-only">Indicateur</span>
            </th>
            {result.scenarios.map(s => (
              <EnTeteDeStatut key={s.statut} scenario={s} meilleur={s.statut === result.meilleur} renvois={renvois.get(s.statut) ?? []} />
            ))}
          </tr>
        </thead>
        {reduit ? (
          <>
            <tbody>
              {ligne(lignes[0], 0)}
              {ecart(1, "non")}
              {protection(apresLEcart, detailOuvert ? "non" : "ecran")}
            </tbody>
            <tbody id="comparateur-lignes-detail" className={cn(!detailOuvert && "hidden print:table-row-group")}>
              {detail.map((row, i) => ligne(row, apresLEcart + 1 + i, i === detail.length - 1 ? "oui" : "non"))}
            </tbody>
          </>
        ) : (
          <tbody>
            {lignes.map((row, i) => ligne(row, i))}
            {protection(lignes.length, avecEcart ? "non" : "oui")}
            {ecart(lignes.length + 1, "oui")}
          </tbody>
        )}
      </table>
    </ZoneDefilante>
  )
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null
  return (
    <ul className="list-inside list-disc text-sm text-amber-800 dark:text-amber-200/90">
      {warnings.map((warning, i) => (
        <li key={i}>{warning}</li>
      ))}
    </ul>
  )
}

const PASTILLE_D_IMPOT = "rounded-full border border-slate-200 bg-card px-2.5 py-0.5 font-mono text-xs tabular-nums text-slate-800 dark:border-slate-700 dark:text-slate-100"

/**
 * Un couple : le gain (ou la perte) d'une imposition commune en grand, puis les deux impôts. Une perte reste en gris :
 * une information, pas une alarme ; jamais en vert.
 */
function GainDuCouple({ couple, personName }: { couple: ComparaisonCouple; personName: (id: string) => string }) {
  const delta = couple.netApresImpotsMaries - couple.netApresImpotsActuel
  const suite = delta > 0 ? "de net après impôts par an" : delta < 0 ? "par an : l'union libre est plus avantageuse" : "par an : aucun écart"
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-violet-200 bg-card px-4 py-3 dark:border-violet-900">
        <p className="w-full text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">{couple.personIds.map(personName).join(" et ")}</p>
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className={cn("font-mono font-bold tabular-nums", delta > 0 ? "text-2xl text-emerald-700 dark:text-emerald-400" : "text-xl text-slate-600 dark:text-slate-300")}>{ecartSigne(delta)}</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">{suite}</span>
        </p>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
        Impôt sur le revenu :<span className={PASTILLE_D_IMPOT}>{euros(couple.impotSurLeRevenuActuel)}</span>en union libre
        <span aria-hidden="true">→</span>
        <span className="sr-only">,</span>
        <span className={PASTILLE_D_IMPOT}>{euros(couple.impotSurLeRevenuMaries)}</span>imposés ensemble
      </p>
    </div>
  )
}

/**
 * Les couples en union libre, imposés ensemble comme s'ils étaient mariés ou pacsés : une carte teintée de violet (ni
 * le vert du meilleur net ni l'ambre des avertissements), qui se détache du tableau sans passer pour un statut. Le
 * titre, où mène la barre de résumé, peut recevoir le focus.
 */
function CoupleComparison({ couples, personName, Titre = "h3" }: { couples: ComparaisonCouple[]; personName: (id: string) => string; Titre?: "h3" | "h4" }) {
  return (
    <section aria-labelledby={ANCRES.comparaisonDuCouple} className="w-fit max-w-full space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/40">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full border border-violet-200 bg-card text-violet-700 dark:border-violet-800 dark:text-violet-300">
          <HeartHandshake className="size-5" />
        </span>
        <div>
          <Titre id={ANCRES.comparaisonDuCouple} tabIndex={-1} className="text-lg font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-slate-100">
            Et si vous étiez mariés ou pacsés ?
          </Titre>
          <p className="text-sm text-slate-600 dark:text-slate-300">Le couple formerait un seul foyer fiscal, imposé en commun.</p>
        </div>
      </div>
      {couples.map(couple => (
        <GainDuCouple key={couple.personIds.join("-")} couple={couple} personName={personName} />
      ))}
      <p className="text-xs text-slate-600 dark:text-slate-400">Mariage et Pacs ont le même effet sur l'impôt sur le revenu. Le reste (succession, protection du conjoint) n'est pas simulé.</p>
    </section>
  )
}

/**
 * Les résultats de la comparaison et, en `children`, le calcul à l'envers : dans l'affichage « Résumé », replié sur la
 * ligne du bouton d'export, où il n'allonge pas la page ; dans l'affichage classique, sous le tableau et ses notes.
 */
function ComparisonResults({ result, activityName, onExporter, children }: { result: ComparaisonResult; activityName: string; onExporter: () => void; children?: ReactNode }) {
  const { notes, renvois } = numeroterNotes(result.scenarios.map(s => ({ id: s.statut, libelle: s.libelle, avertissements: s.warnings, actuelle: s.actuel })))
  // Affichage « Résumé » : tableau réduit (cartes sur téléphone), le reste des lignes à la demande.
  const resume = useAffichageResume()
  const [detailOuvert, setDetailOuvert] = useSectionOuverte("comparateur-toutes-les-lignes")
  const reduit = resume && result.scenarios.length > 0
  return (
    <>
      {result.scenarios.length > 0 ? (
        <div className={cn("flex justify-end", reduit && "flex-wrap items-start gap-x-4 gap-y-2")}>
          {/* Déplié, le calcul prend toute la largeur : le bouton d'export passe dessous, juste au-dessus du tableau. */}
          {reduit ? <div className="min-w-0 flex-1 has-[details[open]]:basis-full">{children}</div> : null}
          <BoutonExportCsv contenu="le tableau de comparaison" onClick={onExporter} />
        </div>
      ) : null}
      <SituationTelleQueSaisie result={result} />
      {reduit ? <CartesDesStatuts result={result} className="sm:hidden print:hidden" /> : null}
      {/* Les pastilles des en-têtes ouvrent leur note dans une bulle, une seule à la fois. */}
      <BullesDesNotes notes={notes}>
        <ComparisonTable result={result} activityName={activityName} renvois={renvois} reduit={reduit} detailOuvert={detailOuvert} className={reduit && !detailOuvert ? "max-sm:hidden print:block" : undefined} />
      </BullesDesNotes>
      {reduit ? <BoutonDuDetail ouvert={detailOuvert} onClick={() => setDetailOuvert(!detailOuvert)} /> : null}
      <RappelDesFrais result={result} />
      <RappelDuBeneficeGarde result={result} />
      <NotesDuTableau notes={notes} activityName={activityName} />
      <ProtectionDesStatuts scenarios={result.scenarios} />
      {reduit ? null : children}
    </>
  )
}

/** Recalcule la comparaison peu après chaque modification de la session ou des réglages. */
function useComparison(session: SessionState, options: ComparaisonOptions, annee: number) {
  const comparer = useCallback(() => window.api.compareStatuts(session, options, annee), [session, options, annee])
  const { resultat: result, erreur: error } = useCalculDiffere(comparer, { echec: "La comparaison a échoué." })
  return { result, error }
}

/** Message d'échec de la comparaison ; rien quand elle a réussi. */
function ErreurDuCalcul({ erreur }: { erreur: string | null }) {
  if (!erreur) return null
  return <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{erreur}</p>
}

/**
 * Statut de société étudié pour l'activité comparée (son statut s'il en est un, la SASU sinon) et son arbitrage
 * rémunération / dividendes : partagés entre la barre de partage du bénéfice et la section « Rémunération ou dividendes ? ».
 */
function useArbitrage(session: SessionState, options: ComparaisonOptions, annee: number, selected: ActiviteComparable | undefined, result: ComparaisonResult | null, choix: { statutEtudie: StatutSociete | undefined; setStatutEtudie: (statut: StatutSociete) => void }) {
  const statutInitial: StatutSociete = selected?.type === "company" && estSocieteIS(selected.legalStatus) ? selected.legalStatus : "SASU"
  // Le statut choisi est enregistré avec les réglages de l'activité ; sans choix, c'est celui de l'activité.
  const statut = choix.statutEtudie ?? statutInitial
  // Au meilleur net, le comparateur a déjà calculé l'arbitrage de chaque statut : on le reprend au lieu de le refaire.
  const auMeilleurNet = options.repartition.mode === "meilleurNet"
  const calcule = useOptimisation(session, options, statut, annee, !!selected && !auMeilleurNet)
  const resultat = auMeilleurNet ? (result?.optimisations?.[statut] ?? null) : calcule.resultat
  return { statut, setStatut: choix.setStatutEtudie, resultat, erreur: auMeilleurNet ? null : calcule.erreur }
}

const scenarioDuStatut = (result: ComparaisonResult | null, statut: StatutSociete) => result?.scenarios.find(s => s.statut === statut)

/**
 * Plus haute rémunération possible sans déficit dans chaque société, pour la note du curseur de la rémunération saisie.
 * Elle ne dépend pas du mode de partage : la comparaison au meilleur net, quand elle est encore là, a déjà l'arbitrage
 * des deux sociétés, et le curseur s'affiche aussitôt en passant à « Ma rémunération ». Sinon, celle du statut étudié
 * vient de son arbitrage, et celle de l'autre est calculée à part, seulement quand la rémunération se saisit.
 */
function usePlafonds(session: SessionState, options: ComparaisonOptions, annee: number, selected: ActiviteComparable | undefined, result: ComparaisonResult | null, arbitrage: ReturnType<typeof useArbitrage>): PlafondsDeRemuneration {
  const autre = STATUTS_SOCIETE.find(statut => statut !== arbitrage.statut) ?? arbitrage.statut
  const calcul = useOptimisation(session, options, autre, annee, !!selected && avecRemunerationSaisie(options.repartition.mode))
  const arbitrageDe = (statut: StatutSociete) => result?.optimisations?.[statut] ?? (statut === arbitrage.statut ? arbitrage.resultat : calcul.resultat)
  return Object.fromEntries(STATUTS_SOCIETE.map(statut => [statut, plafondDeRemuneration(arbitrageDe(statut), statut)])) as PlafondsDeRemuneration
}

interface OptimiseurProps {
  session: SessionState
  annee: number
  selected: ActiviteComparable | undefined
  options: ComparaisonOptions
  arbitrage: ReturnType<typeof useArbitrage>
  result: ComparaisonResult | null
  onChange: (options: ComparaisonOptions) => void
}

/** Arbitrage rémunération / dividendes de l'activité comparée ; la rémunération appliquée rejoint le comparateur. */
function OptimiseurDeLActivite({ session, annee, selected, options, arbitrage, result, onChange }: OptimiseurProps) {
  if (!selected) return null
  // Au meilleur net, la rémunération marquée est celle que le comparateur a retenue pour ce statut.
  const remunerationAppliquee = scenarioDuStatut(result, arbitrage.statut)?.remunerationOptimale?.remunerationNette ?? options.remunerationNette
  return <RemunerationOptimizer session={session} annee={annee} options={options} remunerationAppliquee={remunerationAppliquee} activityName={selected.name} statut={arbitrage.statut} resultat={arbitrage.resultat} erreur={arbitrage.erreur} onAppliquer={remunerationNette => onChange(appliquerRemuneration(options, remunerationNette, arbitrage.resultat))} />
}

/**
 * Activité comparée et réglages du comparateur pour l'année affichée, enregistrés dans la session (voir l'ADR 009).
 * Seuls les réglages que l'utilisateur change y sont retenus : les autres suivent la grille de l'année affichée.
 * La rémunération saisie vaut pour son année ; le mode de partage, la part BNC, les frais et le statut étudié dans
 * « Rémunération ou dividendes ? » valent pour toutes.
 */
function useReglages(vue: SimulationAnnuelle, comparateur: Comparateur | undefined, onComparateurChange: ComparatorPanelProps["onComparateurChange"]) {
  const choix = useMemo(() => reglagesDeLActiviteComparee(vue, comparateur), [vue, comparateur])
  const selected = choix?.activite
  const effectiveOptions = choix?.options ?? NO_ACTIVITY
  const reglages = selected ? comparateur?.reglagesParActivite[selected.id] : undefined

  const modifierReglages = (modifier: (reglages: ReglagesComparateur | undefined) => ReglagesComparateur) => {
    if (!selected) return
    onComparateurChange(actuel => avecReglagesDeLActivite(actuel, selected.id, modifier(actuel?.reglagesParActivite[selected.id])))
  }
  const setOptions = (nouvelles: ComparaisonOptions) => modifierReglages(actuels => retenirLesReglages(actuels, effectiveOptions, nouvelles, vue.annee))
  const setStatutEtudie = (statutEtudie: StatutSociete) => modifierReglages(actuels => ({ ...actuels, statutEtudie }))
  const setPartMiseEnReserve = (partMiseEnReserve: number) => modifierReglages(actuels => ({ ...actuels, partMiseEnReserve }))
  const selectActivity = (activityId: string) => onComparateurChange(actuel => avecActiviteComparee(actuel, activityId))
  const partMiseEnReserve = reglages?.partMiseEnReserve ?? PART_MISE_EN_RESERVE_PAR_DEFAUT

  return { selected, effectiveOptions, statutEtudie: reglages?.statutEtudie, setOptions, setStatutEtudie, selectActivity, partMiseEnReserve, setPartMiseEnReserve }
}

/** L'arbitrage de la société dans sa forme : celui du comparateur, sinon celui affiché s'il porte sur elle. */
function arbitrageDeLaForme(forme: StatutSociete, result: ComparaisonResult | null, arbitrage: { statut: StatutSociete; resultat: OptimisationRemuneration | null }): OptimisationRemuneration | null {
  return result?.optimisations?.[forme] ?? (arbitrage.statut === forme ? arbitrage.resultat : null)
}

/**
 * Transmet l'activité comparée, le résultat et, pour une société à l'IS, son arbitrage rémunération / dividendes à qui
 * le demande ; rien quand il n'y a ni activité ni couple en union libre à comparer. L'arbitrage d'une micro-entreprise
 * ou d'une entreprise individuelle porte sur une société qu'elle n'est pas : la barre de résumé ne le reprend pas.
 * L'arbitrage est celui de sa forme (une SASU : celui de la SASU), pas celui de la société étudiée sous « Approfondir
 * une société » : choisir EURL pour comparer ne change pas la rémunération optimale de la SASU dans la barre.
 */
function useSignalerLaComparaison(onComparaison: ComparatorPanelProps["onComparaison"], selected: ActiviteComparable | undefined, result: ComparaisonResult | null, arbitrage: { statut: StatutSociete; resultat: OptimisationRemuneration | null }) {
  const activite = selected?.name ?? null
  const avecCouples = (result?.couples.length ?? 0) > 0
  const optimisation = selected?.type === "company" && estSocieteIS(selected.legalStatus) ? arbitrageDeLaForme(selected.legalStatus, result, arbitrage) : null
  useEffect(() => {
    onComparaison?.(activite === null && !avecCouples ? null : { activite, result, optimisation })
  }, [onComparaison, activite, avecCouples, result, optimisation])
}

/** L'activité comparée est-elle déjà une société à l'IS (SASU, EURL) ? Sinon, l'étape 3 la suppose en société. */
const estUneSocieteIS = (activite: ActiviteComparable) => activite.type === "company" && estSocieteIS(activite.legalStatus)

/**
 * En haut de l'étape 3, le net des colonnes SASU et EURL du tableau, et le meilleur net : il suit chaque réglage, sans
 * remonter au tableau pour en voir l'effet. Rien tant que la comparaison n'est pas calculée.
 */
function RappelDesColonnesDeSociete({ result }: { result: ComparaisonResult | null }) {
  const societes = result?.scenarios.filter(s => estSocieteIS(s.statut)) ?? []
  if (!result || societes.length === 0) return null
  const meilleur = result.scenarios.find(s => s.statut === result.meilleur)
  return (
    <p role="status" aria-label="Colonnes SASU et EURL du tableau" className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-background px-3 py-2 text-sm dark:border-slate-700">
      <span className="text-slate-600 dark:text-slate-400">Dans le tableau :</span>
      {societes.map(s => (
        <span key={s.statut}>
          {s.libelle} <span className="whitespace-nowrap font-semibold tabular-nums">{euros(s.netApresImpots)}</span>
        </span>
      ))}
      {meilleur ? (
        <span className="text-slate-600 dark:text-slate-400">
          meilleur net : {meilleur.libelle}, <span className="whitespace-nowrap tabular-nums">{euros(meilleur.netApresImpots)}</span>
        </span>
      ) : null}
    </p>
  )
}

interface EtapesProps {
  session: SessionState
  vue: SimulationAnnuelle
  activities: ActiviteComparable[]
  selected: ActiviteComparable
  options: ComparaisonOptions
  result: ComparaisonResult | null
  error: string | null
  arbitrage: ReturnType<typeof useArbitrage>
  plafonds: PlafondsDeRemuneration
  onSelect: (activityId: string) => void
  onChange: (options: ComparaisonOptions) => void
}

/**
 * Sous les réglages du tableau, l'étude d'une seule société : un choix SASU / EURL, au-dessus de tout ce qu'il change
 * (« Rémunération ou dividendes ? » et la barre du partage).
 */
function ApprofondirUneSociete({ statut, onStatut, children }: { statut: StatutSociete; onStatut: (statut: StatutSociete) => void; children: ReactNode }) {
  return (
    <section aria-labelledby="comparateur-approfondir" className="space-y-4 border-t border-slate-300 pt-4 dark:border-slate-600">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h4 id="comparateur-approfondir" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          Approfondir une société
        </h4>
        <ChoixDuStatut statut={statut} onChange={onStatut} />
      </div>
      {children}
    </section>
  )
}

/** Étape 1 : l'activité comparée, dans le titre, et les hypothèses communes à toutes les colonnes. */
function EtapeDeLActivite({ vue, activities, selected, options, result, onSelect, onChange }: EtapesProps) {
  return (
    <EtapeDuComparateur numero={1} titre="Activité comparée" id="comparateur-etape-activite" genre="reglage" aCote={<ChoixDeLActivite activities={activities} selected={selected} onSelect={onSelect} />}>
      <ReglagesCommuns options={options} result={result} bncUtile={partBncUtile(vue, selected)} onChange={changes => onChange({ ...options, ...changes })} />
    </EtapeDuComparateur>
  )
}

/** Ramène à la liste des activités, en haut de l'onglet, et lui donne le focus. */
function allerAuChoixDeLActivite() {
  const liste = document.getElementById(ID_DU_CHOIX_DE_L_ACTIVITE)
  if (!liste) return
  liste.scrollIntoView({ block: "center", behavior: comportementDuDefilement() })
  liste.focus({ preventScroll: true })
}

/**
 * Sous le titre du résultat, l'activité comparée et de quoi en changer sans remonter la chercher ; seulement s'il y a
 * plusieurs activités à comparer.
 */
function RappelDeLActivite({ activities, selected }: { activities: ActiviteComparable[]; selected: ActiviteComparable }) {
  if (activities.length < 2) return null
  return (
    <p className="-mt-1 text-sm text-slate-600 dark:text-slate-400">
      Pour « {selected.name} » ·{" "}
      <button type="button" onClick={allerAuChoixDeLActivite} className="inline-flex min-h-6 items-center rounded-sm font-medium text-blue-700 underline-offset-2 hover:underline pointer-coarse:min-h-11 dark:text-blue-400 print:hidden">
        changer d'activité ↑
      </button>
    </p>
  )
}

/**
 * Étape 2 : le résultat. Les avertissements du calcul, le tableau (ou les cartes), ses notes, le calcul à l'envers, la
 * réponse à « mariage ou Pacs ? », puis les années, qui ne portent que sur l'activité comparée.
 */
function EtapeDuResultat({ session, vue, activities, selected, options, result, error, couples, personName, partMiseEnReserve, onPartMiseEnReserve }: EtapesProps & { couples: ComparaisonCouple[]; personName: (id: string) => string; partMiseEnReserve: number; onPartMiseEnReserve: (part: number) => void }) {
  return (
    <EtapeDuComparateur numero={2} titre={`Résultat ${vue.annee} : net dans la poche selon le statut`} id="comparateur-etape-resultat" genre="resultat">
      <RappelDeLActivite activities={activities} selected={selected} />
      <WarningList warnings={avertissementsSansLeVerdict(result?.warnings ?? [])} />
      <ErreurDuCalcul erreur={error} />
      <CommentLireLeTableau />
      {result ? (
        <ComparisonResults result={result} activityName={selected.name} onExporter={() => exporterComparaisonCsv(vue, result, options, selected.name)}>
          {/* Le calcul à l'envers du tableau : les mêmes colonnes, pour un net visé plutôt que pour le chiffre d'affaires saisi. */}
          <CombienFacturer session={session} annee={vue.annee} options={options} activite={selected} />
        </ComparisonResults>
      ) : null}
      {couples.length > 0 ? <CoupleComparison couples={couples} personName={personName} Titre="h4" /> : null}
      <SurToutesLesAnnees session={session} activityId={selected.id} activityName={selected.name} partMiseEnReserve={partMiseEnReserve} onPartMiseEnReserve={onPartMiseEnReserve} />
    </EtapeDuComparateur>
  )
}

/**
 * Étape 3 : tout ce qui ne change que les colonnes SASU et EURL. Le rappel de leur net, le partage du bénéfice et sa
 * rémunération, « Rémunération ou dividendes ? » (cartes et courbe, dont le bouton applique une rémunération), et la
 * barre du partage. Pour une activité qui n'est pas une société, le titre la suppose en société.
 */
function EtapeDeLaSociete({ session, vue, selected, options, result, arbitrage, plafonds, onChange }: EtapesProps) {
  const societe = estUneSocieteIS(selected)
  return (
    <EtapeDuComparateur numero={3} titre={societe ? "Optimiser la société : SASU et EURL" : "Et en société ? Régler la SASU et l'EURL"} id={ANCRES.reglageDeLaSociete} genre="reglage" aCote={<ColonnesTouchees societe>colonnes SASU, EURL</ColonnesTouchees>}>
      <p className="max-w-prose text-sm text-slate-600 dark:text-slate-400">
        {societe ? `Comment « ${selected.name} » partage son bénéfice entre rémunération et dividendes.` : `Si « ${selected.name} » passait en société, comment partager le bénéfice entre rémunération et dividendes ?`} Ces réglages ne changent que les colonnes SASU et EURL du tableau.
      </p>
      <RappelDesColonnesDeSociete result={result} />
      <ReglagesDeLaSociete options={options} result={result} plafonds={plafonds} onChange={changes => onChange({ ...options, ...changes })} />
      <ApprofondirUneSociete statut={arbitrage.statut} onStatut={arbitrage.setStatut}>
        <OptimiseurDeLActivite session={session} annee={vue.annee} selected={selected} options={options} arbitrage={arbitrage} result={result} onChange={onChange} />
        {/* Affichage « Résumé » : le partage du bénéfice n'est déplié d'office qu'en répartition personnalisée, où il sert à régler. */}
        <ReplieEnResume titre={`Partage du bénéfice en ${arbitrage.statut} (barre réglable)`} id="comparateur-partage" className="text-sm" replie={options.repartition.mode !== "personnalisee"}>
          <RepartitionDuBenefice activityName={selected.name} statut={arbitrage.statut} scenario={scenarioDuStatut(result, arbitrage.statut)} optimisation={arbitrage.resultat} options={options} onChange={onChange} />
        </ReplieEnResume>
      </ApprofondirUneSociete>
    </EtapeDuComparateur>
  )
}

/** Titre du comparateur et verdict. */
function EnTeteDuComparateur({ result, activite }: { result: ComparaisonResult | null; activite: string | undefined }) {
  return (
    <>
      {/* Le titre peut recevoir le focus quand un lien mène au comparateur. */}
      <h2 id={ANCRES.titreDuComparateur} tabIndex={-1} className="text-2xl font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-slate-100">
        Comparateur de statuts
      </h2>
      <VerdictDuComparateur result={result} activite={activite} />
    </>
  )
}

/**
 * Comment lire le tableau : une puce par notion, le mot qu'on cherche dans le tableau en gras, repliée d'office au-dessus
 * du tableau. Que l'activité soit simulée dans chaque statut, l'étape 1 le dit déjà.
 */
function CommentLireLeTableau() {
  const notion = "font-medium text-slate-800 dark:text-slate-100"
  return (
    <Depliable titre="Comment lire le tableau" id="comparateur-explication" className="text-sm">
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
        <li>
          <span className={notion}>Net dans la poche</span> : celui de tout le foyer, après cotisations et impôts, comme dans « Mes résultats ». Seule la dernière ligne du détail porte sur l'activité comparée seule.
        </li>
        <li>
          <span className={notion}>Colonne « actuel »</span> : votre situation telle que saisie.
        </li>
        <li>
          <span className={notion}>Charges</span> : celles d'une micro-entreprise deviennent déductibles en société et en EI au réel ; en portage salarial, ce sont des frais remboursés.
        </li>
        <li>
          <span className={notion}>Portage salarial</span> : la société de portage facture vos prestations et vous verse un salaire, après ses frais de gestion.
        </li>
        <li>
          <span className={notion}>Frais de gestion</span> : chaque autre statut n'ajoute que l'écart estimé avec ceux de votre statut actuel.
        </li>
      </ul>
    </Depliable>
  )
}

/**
 * Comparateur de statuts : l'activité choisie est simulée en SASU, EURL, EI au réel, micro-entreprise
 * (avec et sans versement libératoire) et portage salarial, le reste de la simulation restant identique. Les couples en union
 * libre sont aussi comparés avec une imposition commune. Avec une activité, l'onglet suit trois étapes : ce qui est
 * comparé (réglage), le résultat, puis les réglages de la société (SASU, EURL).
 */
export function ComparatorPanel({ session, annee, onComparateurChange, onComparaison }: ComparatorPanelProps) {
  // Le comparateur porte sur l'année affichée : réglages par défaut tirés de sa grille, exports à son nom.
  const vue = useMemo(() => vueDeLAnnee(session, annee), [session, annee])
  const activities = comparableActivities(vue)
  const { selected, effectiveOptions, statutEtudie, setOptions, setStatutEtudie, selectActivity, partMiseEnReserve, setPartMiseEnReserve } = useReglages(vue, session.comparateur, onComparateurChange)

  const { result, error } = useComparison(session, effectiveOptions, vue.annee)
  const arbitrage = useArbitrage(session, effectiveOptions, vue.annee, selected, result, { statutEtudie, setStatutEtudie })
  const plafonds = usePlafonds(session, effectiveOptions, vue.annee, selected, result, arbitrage)
  const couples = result?.couples ?? []
  useSignalerLaComparaison(onComparaison, selected, result, arbitrage)
  if (!selected && couples.length === 0) return null

  const personName = (id: string) => session.entities.find(e => e.id === id)?.name ?? id

  if (!selected) {
    // Seuls des couples sont comparés : ni activité à régler, ni étapes.
    return (
      <section className="mt-12 space-y-4" aria-labelledby={ANCRES.titreDuComparateur}>
        <EnTeteDuComparateur result={result} activite={undefined} />
        <ErreurDuCalcul erreur={error} />
        {result ? <ComparisonResults result={result} activityName="" onExporter={() => exporterComparaisonCsv(vue, result, effectiveOptions, "")} /> : null}
        <CoupleComparison couples={couples} personName={personName} />
      </section>
    )
  }

  const etapes: EtapesProps = { session, vue, activities, selected, options: effectiveOptions, result, error, arbitrage, plafonds, onSelect: selectActivity, onChange: setOptions }
  return (
    <section className="mt-12 space-y-5" aria-labelledby={ANCRES.titreDuComparateur}>
      <EnTeteDuComparateur result={result} activite={selected.name} />
      <EtapeDeLActivite {...etapes} />
      <EtapeDuResultat {...etapes} couples={couples} personName={personName} partMiseEnReserve={partMiseEnReserve} onPartMiseEnReserve={setPartMiseEnReserve} />
      <EtapeDeLaSociete {...etapes} />
    </section>
  )
}
