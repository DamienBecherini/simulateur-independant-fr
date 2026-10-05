// src/ui/components/ComparatorPanel.tsx

import { useEffect, useMemo, useState } from "react"
import { useOptimisation } from "../hooks/useOptimisation"
import { appliquerRemuneration, avecActiviteComparee, avecReglagesDeLActivite, comparableActivities, partBncUtile, plafondDeRemuneration, reglagesDeLActiviteComparee, retenirLesReglages } from "@/lib/comparateur-options"
import { numeroterNotes, type Note } from "@/lib/notes"
import { vueDeLAnnee } from "@/backend/logic/annees"
import { cn } from "@/lib/utils"
import { exporterComparaisonCsv } from "../exports-texte"
import { BoutonExportCsv } from "./BoutonExportCsv"
import { Depliable } from "./Depliable"
import { RemunerationOptimizer } from "./RemunerationOptimizer"
import { RepartitionDuBenefice } from "./RepartitionBenefice"
import { ReglagesDuComparateur } from "./ReglagesDuComparateur"
import { ZoneDefilante } from "./ZoneDefilante"
import { BoutonDuDetail, CartesDesStatuts, NoteDesFraisSupposes, VerdictDuComparateur } from "./SyntheseDuComparateur"
import { ReplieEnResume } from "./ReplieEnResume"
import { useAffichageResume } from "../hooks/useAffichage"
import { useSectionOuverte } from "../hooks/useSectionOuverte"
import { libelleDuCoutDesTrimestres, type ResumeDeLaComparaison } from "@/lib/resume"
import type { ComparaisonCouple, ComparaisonOptions, ComparaisonResult, Comparateur, Company, MicroEntreprise, ReglagesComparateur, ScenarioStatut, SessionState, SimulationAnnuelle, StatutSociete } from "@/types"
import { COLONNE_FIXE } from "../colonne-fixe"

/** Fond de l'en-tête du tableau, rendu opaque pour sa première cellule, fixe : le gris translucide sur le fond de la page. */
const FOND_DE_L_EN_TETE = "bg-slate-100 dark:bg-[color-mix(in_oklab,var(--color-slate-800)_80%,var(--background))]"

interface ComparatorPanelProps {
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

function formatMoney(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
}

function formatSignedMoney(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatMoney(Math.abs(n))}`
}

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

/** Lignes du tableau : libellé et valeur d'une colonne. Seule la dernière porte sur l'activité comparée. */
const rows = (activityName: string): { label: string; value: (s: ScenarioStatut) => string; strong?: boolean }[] => [
  { label: "Net dans la poche", value: s => formatMoney(s.netApresImpots), strong: true },
  { label: "Taux global de prélèvement", value: rate },
  { label: "Frais de fonctionnement", value: s => formatMoney(s.fraisFonctionnement) },
  { label: "Cotisations sociales", value: s => formatMoney(s.cotisationsSociales) },
  { label: "Impôt sur les sociétés", value: s => formatMoney(s.impotSocietes) },
  { label: "Impôt sur le revenu", value: s => formatMoney(s.impotSurLeRevenu) },
  { label: "Prélèvements sociaux", value: s => formatMoney(s.prelevementsSociaux) },
  { label: `Conservé dans « ${activityName} »`, value: s => formatMoney(s.resultatConserveActivite) }
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
      rémunération optimale : <span className="whitespace-nowrap font-medium">{formatMoney(retenue.remunerationNette)} nets</span>
      {retenue.avecRetraite ? <span className="block text-slate-600 dark:text-slate-400">avec 4 trimestres de retraite</span> : null}
      {retenue.retraiteHorsDAtteinte ? <span className="block text-amber-800 dark:text-amber-300">4 trimestres hors d'atteinte</span> : null}
      {/* Cochée ou non, ce que coûtent les 4 trimestres dans cette colonne : le choix se fait en connaissance de cause. */}
      {retenue.coutDesQuatreTrimestres ? <span className="block text-slate-600 dark:text-slate-400">{libelleDuCoutDesTrimestres(retenue.coutDesQuatreTrimestres)}</span> : null}
    </span>
  )
}

const pastilleNote = "inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100"

/** En-tête d'une colonne : le statut, ses mentions (actuel, meilleur net) et ses renvois aux notes sous le tableau. */
function EnTeteDeStatut({ scenario, meilleur, renvois }: { scenario: ScenarioStatut; meilleur: boolean; renvois: number[] }) {
  const mentions = [scenario.actuel ? "actuel" : null, meilleur ? "meilleur net" : null].filter(Boolean).join(" · ")
  return (
    <th scope="col" className={cn("px-3 py-2 text-right align-top font-medium text-slate-700 dark:text-slate-200", meilleur && "bg-emerald-100 dark:bg-emerald-900/40")}>
      {scenario.libelle}
      <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">{mentions || " "}</span>
      {/* Le net du statut actuel diffère de celui des résultats du foyer : il compte des frais de fonctionnement supposés. */}
      {scenario.actuel && scenario.fraisFonctionnement > 0 ? <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">frais supposés compris</span> : null}
      <RemunerationRetenue scenario={scenario} />
      {scenario.horsPlafond ? <span className="block text-xs font-medium text-amber-800 dark:text-amber-300">hors plafond · 2 ans au plus</span> : null}
      {renvois.length > 0 ? (
        <span className="mt-1 flex justify-end gap-1">
          {renvois.map(numero => (
            <a key={numero} href={`#note-comparateur-${numero}`} aria-label={`Voir la note ${numero}`} className={cn(pastilleNote, "hover:bg-amber-200 dark:hover:bg-amber-800")}>
              {numero}
            </a>
          ))}
        </span>
      ) : null}
    </th>
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
  const current = result.scenarios.find(s => s.actuel)
  const best = (s: ScenarioStatut) => s.statut === result.meilleur

  const lignes = rows(activityName).map(row => (
    <tr key={row.label} className="border-t border-slate-200 dark:border-slate-700">
      <th scope="row" className={cn(COLONNE_FIXE, "bg-background px-3 py-2 text-left font-normal text-slate-600 dark:text-slate-300")}>
        {row.label}
      </th>
      {result.scenarios.map(s => (
        <td key={s.statut} className={cn("px-3 py-2 text-right tabular-nums", row.strong && "font-semibold", best(s) && "bg-emerald-50 dark:bg-emerald-950/30")}>
          {row.value(s)}
        </td>
      ))}
    </tr>
  ))
  const protection = (
    <tr className="border-t border-slate-200 dark:border-slate-700">
      <th scope="row" className={cn(COLONNE_FIXE, "bg-background px-3 py-2 text-left font-normal text-slate-600 dark:text-slate-300")}>
        Protection sociale
      </th>
      {result.scenarios.map(s => (
        <td key={s.statut} className={cn("px-3 py-2 text-right", best(s) && "bg-emerald-50 dark:bg-emerald-950/30")} title={s.protectionSociale.resume}>
          <span aria-hidden="true" className="tracking-wider text-amber-500">
            {stars(s.protectionSociale.etoiles)}
          </span>
          <span className="sr-only">{s.protectionSociale.etoiles} sur 5</span>
          <span className="block text-xs text-slate-600 dark:text-slate-400">{s.protectionSociale.trimestres} trim. retraite</span>
        </td>
      ))}
    </tr>
  )
  const ecart = current ? (
    <tr className="border-t border-slate-200 dark:border-slate-700">
      <th scope="row" className={cn(COLONNE_FIXE, "bg-background px-3 py-2 text-left font-normal text-slate-600 dark:text-slate-300")}>
        Écart avec le statut actuel
      </th>
      {result.scenarios.map(s => (
        <td key={s.statut} className={cn("px-3 py-2 text-right tabular-nums", deltaClass(s.netApresImpots - current.netApresImpots), best(s) && "bg-emerald-50 dark:bg-emerald-950/30")}>
          {s.actuel ? "—" : formatSignedMoney(s.netApresImpots - current.netApresImpots)}
        </td>
      ))}
    </tr>
  ) : null

  return (
    <ZoneDefilante libelle="Tableau de comparaison" className={cn("rounded-lg border border-slate-200 dark:border-slate-700", className)}>
      <table className="w-full min-w-[48rem] text-sm print:min-w-0 print:text-[8pt]" aria-label="Comparaison des statuts">
        <thead className="bg-slate-100 dark:bg-slate-800/80">
          <tr>
            <th scope="col" className={cn(COLONNE_FIXE, FOND_DE_L_EN_TETE, "px-3 py-2 text-left")}>
              <span className="sr-only">Indicateur</span>
            </th>
            {result.scenarios.map(s => (
              <EnTeteDeStatut key={s.statut} scenario={s} meilleur={best(s)} renvois={renvois.get(s.statut) ?? []} />
            ))}
          </tr>
        </thead>
        {reduit ? (
          <>
            <tbody>
              {lignes[0]}
              {ecart}
              {protection}
            </tbody>
            <tbody id="comparateur-lignes-detail" className={cn(!detailOuvert && "hidden print:table-row-group")}>
              {lignes.slice(1)}
            </tbody>
          </>
        ) : (
          <tbody>
            {lignes}
            {protection}
            {ecart}
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

/** Ce que recouvre chaque note de protection sociale. */
function ProtectionDetails({ scenarios }: { scenarios: ScenarioStatut[] }) {
  if (scenarios.length === 0) return null
  return (
    <Depliable titre="Ce que recouvre la note de protection sociale" id="comparateur-note-protection" className="text-sm text-slate-600 dark:text-slate-300">
      <ul className="mt-2 space-y-1">
        {scenarios.map(s => (
          <li key={s.statut}>
            <span className="font-medium">
              {s.libelle} ({s.protectionSociale.etoiles}/5) :
            </span>{" "}
            {s.protectionSociale.resume}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-slate-600 dark:text-slate-400">Note indicative : la cinquième étoile correspond au salarié classique, seul à cotiser à l'assurance chômage.</p>
    </Depliable>
  )
}

/** Avertissements des statuts, numérotés : les pastilles des en-têtes de colonne y renvoient. */
function NotesDuTableau({ notes, activityName }: { notes: Note[]; activityName: string }) {
  if (notes.length === 0) return null
  return (
    <div className="space-y-2 text-sm text-amber-900 dark:text-amber-100">
      <p className="font-medium">Notes sur « {activityName} »</p>
      <ol className="space-y-2">
        {notes.map(note => (
          <li key={note.numero} id={`note-comparateur-${note.numero}`} className="flex scroll-mt-24 items-start gap-2">
            <span aria-hidden="true" className={pastilleNote}>
              {note.numero}
            </span>
            <p>
              <span className="sr-only">Note {note.numero}. </span>
              <span className="font-medium">{note.colonnes.join(", ")} :</span> {note.texte}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function CoupleComparison({ couples, personName }: { couples: ComparaisonCouple[]; personName: (id: string) => string }) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100">Et si vous étiez mariés ou pacsés ?</h3>
      {couples.map(couple => {
        const delta = couple.netApresImpotsMaries - couple.netApresImpotsActuel
        return (
          <p key={couple.personIds.join("-")} className="text-sm text-slate-600 dark:text-slate-300">
            {couple.personIds.map(personName).join(" et ")} : impôt sur le revenu de {formatMoney(couple.impotSurLeRevenuActuel)} en union libre, {formatMoney(couple.impotSurLeRevenuMaries)} avec une imposition commune, soit <span className={cn("font-semibold", deltaClass(delta))}>{formatSignedMoney(delta)}</span> sur le net après impôts.
          </p>
        )
      })}
    </div>
  )
}

function ComparisonResults({ result, activityName, onExporter }: { result: ComparaisonResult; activityName: string; onExporter: () => void }) {
  const { notes, renvois } = numeroterNotes(result.scenarios.map(s => ({ id: s.statut, libelle: s.libelle, avertissements: s.warnings })))
  // Affichage « Résumé » : tableau réduit (cartes sur téléphone), le reste des lignes à la demande.
  const resume = useAffichageResume()
  const [detailOuvert, setDetailOuvert] = useSectionOuverte("comparateur-toutes-les-lignes")
  const reduit = resume && result.scenarios.length > 0
  return (
    <>
      {result.scenarios.length > 0 ? (
        <div className="flex justify-end">
          <BoutonExportCsv contenu="le tableau de comparaison" onClick={onExporter} />
        </div>
      ) : null}
      {reduit ? <CartesDesStatuts result={result} className="sm:hidden print:hidden" /> : null}
      <ComparisonTable result={result} activityName={activityName} renvois={renvois} reduit={reduit} detailOuvert={detailOuvert} className={reduit && !detailOuvert ? "max-sm:hidden print:block" : undefined} />
      {reduit ? <BoutonDuDetail ouvert={detailOuvert} onClick={() => setDetailOuvert(!detailOuvert)} /> : null}
      <NoteDesFraisSupposes result={result} />
      <NotesDuTableau notes={notes} activityName={activityName} />
      <ProtectionDetails scenarios={result.scenarios} />
    </>
  )
}

/** Recalcule la comparaison peu après chaque modification de la session ou des réglages. */
function useComparison(session: SessionState, options: ComparaisonOptions, annee: number) {
  const [result, setResult] = useState<ComparaisonResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const comparison = await window.api.compareStatuts(session, options, annee)
        if (cancelled) return
        setResult(comparison)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "La comparaison a échoué.")
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [session, options, annee])

  return { result, error }
}

/**
 * Statut de société étudié pour l'activité comparée (son statut s'il en est un, la SASU sinon) et son arbitrage
 * rémunération / dividendes : partagés entre la barre de partage du bénéfice et la section « Rémunération ou dividendes ? ».
 */
function useArbitrage(session: SessionState, options: ComparaisonOptions, annee: number, selected: Company | MicroEntreprise | undefined, result: ComparaisonResult | null, choix: { statutEtudie: StatutSociete | undefined; setStatutEtudie: (statut: StatutSociete) => void }) {
  const statutInitial: StatutSociete = selected?.type === "company" && selected.legalStatus === "EURL" ? "EURL" : "SASU"
  // Le statut choisi est enregistré avec les réglages de l'activité ; sans choix, c'est celui de l'activité.
  const statut = choix.statutEtudie ?? statutInitial
  // Au meilleur net, le comparateur a déjà calculé l'arbitrage de chaque statut : on le reprend au lieu de le refaire.
  const auMeilleurNet = options.repartition.mode === "meilleurNet"
  const calcule = useOptimisation(session, options, statut, annee, !!selected && !auMeilleurNet)
  const resultat = auMeilleurNet ? (result?.optimisations?.[statut] ?? null) : calcule.resultat
  return { statut, setStatut: choix.setStatutEtudie, resultat, erreur: auMeilleurNet ? null : calcule.erreur }
}

const scenarioDuStatut = (result: ComparaisonResult | null, statut: StatutSociete) => result?.scenarios.find(s => s.statut === statut)

interface OptimiseurProps {
  session: SessionState
  annee: number
  selected: Company | MicroEntreprise | undefined
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
  return <RemunerationOptimizer session={session} annee={annee} options={options} remunerationAppliquee={remunerationAppliquee} activityName={selected.name} statut={arbitrage.statut} onStatut={arbitrage.setStatut} resultat={arbitrage.resultat} erreur={arbitrage.erreur} onAppliquer={remunerationNette => onChange(appliquerRemuneration(options, remunerationNette, arbitrage.resultat))} />
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
  const selectActivity = (activityId: string) => onComparateurChange(actuel => avecActiviteComparee(actuel, activityId))

  return { selected, effectiveOptions, statutEtudie: reglages?.statutEtudie, setOptions, setStatutEtudie, selectActivity }
}

/** Transmet l'activité comparée et le résultat à qui le demande ; rien quand il n'y a pas d'activité à comparer. */
function useSignalerLaComparaison(onComparaison: ComparatorPanelProps["onComparaison"], selected: Company | MicroEntreprise | undefined, result: ComparaisonResult | null) {
  const activite = selected?.name ?? null
  useEffect(() => {
    onComparaison?.(activite === null ? null : { activite, result })
  }, [onComparaison, activite, result])
}

/**
 * Comparateur de statuts : l'activité choisie est simulée en SASU, EURL, EI au réel et micro-entreprise
 * (avec et sans versement libératoire), le reste de la simulation restant identique. Les couples en union
 * libre sont aussi comparés avec une imposition commune.
 */
export function ComparatorPanel({ session, annee, onComparateurChange, onComparaison }: ComparatorPanelProps) {
  // Le comparateur porte sur l'année affichée : réglages par défaut tirés de sa grille, exports à son nom.
  const vue = useMemo(() => vueDeLAnnee(session, annee), [session, annee])
  const activities = comparableActivities(vue)
  const { selected, effectiveOptions, statutEtudie, setOptions, setStatutEtudie, selectActivity } = useReglages(vue, session.comparateur, onComparateurChange)

  const { result, error } = useComparison(session, effectiveOptions, vue.annee)
  const arbitrage = useArbitrage(session, effectiveOptions, vue.annee, selected, result, { statutEtudie, setStatutEtudie })
  const couples = result?.couples ?? []
  useSignalerLaComparaison(onComparaison, selected, result)
  if (!selected && couples.length === 0) return null

  const personName = (id: string) => session.entities.find(e => e.id === id)?.name ?? id

  return (
    <section className="mt-12 space-y-4" aria-labelledby="comparateur-titre">
      <div>
        {/* Le titre reçoit le focus quand « Comparer ses statuts » mène ici (affichage « Panneaux »). */}
        <h2 id="comparateur-titre" tabIndex={-1} className="text-2xl font-semibold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-slate-100">
          Comparateur de statuts
        </h2>
        <ReplieEnResume titre={`Année ${vue.annee} : ce que compare le tableau`} id="comparateur-explication" className="text-sm text-slate-600 dark:text-slate-400">
          <p className="text-sm text-slate-600 dark:text-slate-400">Année {vue.annee}. L'activité choisie est simulée dans chaque statut ; le reste de la simulation ne change pas. Les montants portent sur toute la simulation, sauf la dernière ligne, propre à l'activité comparée. Les charges d'une micro-entreprise y deviennent déductibles dans les statuts au réel (société, EI).</p>
        </ReplieEnResume>
      </div>
      <VerdictDuComparateur result={result} activite={selected?.name} />

      {selected ? (
        <>
          <ReglagesDuComparateur
            activities={activities}
            selected={selected}
            options={effectiveOptions}
            result={result}
            statut={arbitrage.statut}
            plafond={plafondDeRemuneration(arbitrage.resultat, arbitrage.statut)}
            bncUtile={partBncUtile(vue, selected)}
            onSelect={selectActivity}
            onChange={changes => setOptions({ ...effectiveOptions, ...changes })}
          />
          <WarningList warnings={result?.warnings ?? []} />
          {/* Affichage « Résumé » : le partage du bénéfice n'est déplié d'office qu'en répartition personnalisée, où il sert à régler. */}
          <ReplieEnResume titre={`Partage du bénéfice en ${arbitrage.statut} (barre réglable)`} id="comparateur-partage" className="text-sm" replie={effectiveOptions.repartition.mode !== "personnalisee"}>
            <RepartitionDuBenefice activityName={selected.name} statut={arbitrage.statut} onStatut={arbitrage.setStatut} scenario={scenarioDuStatut(result, arbitrage.statut)} optimisation={arbitrage.resultat} options={effectiveOptions} onChange={setOptions} />
          </ReplieEnResume>
        </>
      ) : null}

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p> : null}

      {result ? <ComparisonResults result={result} activityName={selected?.name ?? ""} onExporter={() => exporterComparaisonCsv(vue, result, effectiveOptions, selected?.name ?? "")} /> : null}
      <OptimiseurDeLActivite session={session} annee={vue.annee} selected={selected} options={effectiveOptions} arbitrage={arbitrage} result={result} onChange={setOptions} />
      {couples.length > 0 ? <CoupleComparison couples={couples} personName={personName} /> : null}
    </section>
  )
}
