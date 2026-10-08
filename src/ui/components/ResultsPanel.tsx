// src/ui/components/ResultsPanel.tsx

import type { ActivityResult, FoyerFiscalResult, FraisProfessionnelsResult, PersonResult, SalarieDeLActivite, SimulationReport, VersementLiberatoireInfo } from "@/types"
import { lectureDesReserves } from "@/lib/reserves"
import { cn } from "@/lib/utils"
import { useId, type ReactNode } from "react"
import { useAffichageResume } from "../hooks/useAffichage"
import { classeDuDetail, useDetailDesCartes } from "../hooks/useDetailsDesCartes"
import { BoutonDuDetailDesCartes, FournisseurDesDetails } from "./DetailsDesCartes"
import { ReplieEnResume } from "./ReplieEnResume"

type ResultsPanelProps = {
  report: SimulationReport | null
  error: string | null
  /** Affiché juste sous le bilan (affichage « Résumé » : la synthèse des années). */
  apresLeBilan?: ReactNode
}

function formatMoney(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €"
}

/** Part de ce que l'activité verse aux personnes par rapport à son chiffre d'affaires (ex. « 62 % du CA »). */
function shareOfRevenue(activity: ActivityResult): string | null {
  if (activity.chiffreAffaires <= 0) return null
  const share = activity.revenuVerse / activity.chiffreAffaires
  return `${share.toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 0 })} du CA`
}

/** Les destinations de l'argent, dans l'ordre de la barre de répartition. */
const bilanShares = [
  { key: "net", label: "Net dans la poche", color: "bg-emerald-500" },
  { key: "conserve", label: "Conservé dans les sociétés", color: "bg-sky-500" },
  { key: "prelevements", label: "Prélèvements", color: "bg-rose-500" },
  { key: "nonRattache", label: "Non rattaché à une personne", color: "bg-slate-400" }
] as const

/**
 * Bilan de la simulation : part des revenus qui part en cotisations et impôts, part conservée
 * dans les sociétés, part qui reste dans la poche. C'est le repère à comparer d'un scénario à l'autre.
 */
function BilanCard({ report }: { report: SimulationReport }) {
  const { bilan } = report
  const base = bilan.revenusAvantPrelevements
  const percent = (amount: number) => (base > 0 ? (amount / base).toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 }) : null)
  const amounts = { net: report.totalNetApresImpots, conserve: bilan.resultatConserve, prelevements: bilan.totalPrelevements, nonRattache: bilan.nonRattache }
  const origin = [`chiffre d'affaires ${formatMoney(bilan.chiffreAffaires)}`, bilan.charges > 0 ? `charges ${formatMoney(bilan.charges)}` : null, bilan.revenusDirects > 0 ? `salaires et autres revenus ${formatMoney(bilan.revenusDirects + bilan.cotisationsSalariales)}` : null].filter(Boolean).join(" · ")

  return (
    <div id="bilan" className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Net dans la poche</p>
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatMoney(amounts.net)}
            {percent(amounts.net) ? <span className="ml-2 text-base font-semibold text-emerald-700 dark:text-emerald-400">{percent(amounts.net)} des revenus</span> : null}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Taux global de prélèvement</p>
          <p className="text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-400">{percent(amounts.prelevements) ?? "—"}</p>
        </div>
      </div>

      {base > 0 ? (
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="img" aria-label="Répartition des revenus avant prélèvements">
          {bilanShares.map(share => (amounts[share.key] > 0 ? <div key={share.key} className={share.color} style={{ width: `${(amounts[share.key] / base) * 100}%` }} title={`${share.label} : ${percent(amounts[share.key])}`} /> : null))}
        </div>
      ) : null}

      <ReplieEnResume titre="Détail du calcul" id="detail-du-calcul" className="mt-3 text-sm">
        {/* Deux listes de définitions côte à côte : un <dl> n'accepte qu'un niveau de <div> autour de ses paires. */}
        <div className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <dl className="space-y-1">
            <Row label="Revenus avant prélèvements" value={formatMoney(base)} hint={origin} />
            <Row label="Cotisations sociales des activités" value={`− ${formatMoney(bilan.cotisationsSociales)}`} />
            {bilan.cotisationsSalariales > 0 ? <Row label="Cotisations salariales" value={`− ${formatMoney(bilan.cotisationsSalariales)}`} /> : null}
            {bilan.impotSocietes > 0 ? <Row label="Impôt sur les sociétés" value={`− ${formatMoney(bilan.impotSocietes)}`} /> : null}
            <Row label="Impôt sur le revenu" value={`− ${formatMoney(bilan.impotSurLeRevenu)}`} />
            {bilan.prelevementsSociaux > 0 ? <Row label="Prélèvements sociaux sur dividendes" value={`− ${formatMoney(bilan.prelevementsSociaux)}`} /> : null}
          </dl>
          <dl className="space-y-1">
            {bilanShares.map(share =>
              amounts[share.key] !== 0 || share.key === "net" || share.key === "prelevements" ? (
                <Row key={share.key} label={share.key === "conserve" && amounts.conserve < 0 ? "Déficit des sociétés" : share.label} value={formatMoney(amounts[share.key])} hint={percent(amounts[share.key])} strong={share.key === "net"} pastille={share.color} />
              ) : null
            )}
          </dl>
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Les revenus avant prélèvements sont le chiffre d'affaires moins les charges, plus les salaires et autres revenus saisis sur les personnes. Les cotisations d'un salaire ne sont comptées que si son brut est saisi, et seulement pour leur part salariale, sauf pour un salarié d'une activité de la simulation : ses cotisations patronales sont alors comptées avec celles de l'activité.</p>
        {bilan.resultatConserve > 0 ? (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Le bénéfice conservé dans une société a payé l'impôt sur les sociétés, mais pas encore l'impôt personnel : il sera imposé le jour où il sera versé (dividendes, vente ou liquidation). Le taux de prélèvement affiché est donc provisoire pour cette part, et un scénario qui conserve davantage paraît moins taxé sans que cet argent soit disponible.
          </p>
        ) : null}
      </ReplieEnResume>
    </div>
  )
}

const dividendOptionLabels: Record<NonNullable<FoyerFiscalResult["optionDividendes"]>, string> = {
  pfu: "Dividendes imposés au prélèvement forfaitaire, plus favorable ici que le barème.",
  bareme: "Dividendes imposés au barème après abattement, plus favorable ici que le prélèvement forfaitaire."
}

/** Une ligne « libellé — montant » d'une carte de résultats. */
function Row({ label, value, hint, strong = false, pastille, className }: { label: string; value: string; hint?: string | null; strong?: boolean; pastille?: string; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-2", className)}>
      <dt className={cn("flex items-start gap-2", strong ? "font-medium text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-400")}>
        {/* Pastille de la couleur de la part dans la barre de répartition. */}
        {pastille ? <span aria-hidden="true" className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", pastille)} /> : null}
        {label}
      </dt>
      <dd className={`text-right tabular-nums ${strong ? "font-semibold text-emerald-700 dark:text-emerald-400" : "font-medium"}`}>
        <span className="whitespace-nowrap">{value}</span>
        {hint ? <span className="block text-xs font-normal text-slate-600 dark:text-slate-400">{hint}</span> : null}
      </dd>
    </div>
  )
}

function Card({ title, subtitle, warnings, className, children }: { title: string; subtitle: string; warnings: string[]; className?: string; children: ReactNode }) {
  return (
    <article className={cn("rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80", className)}>
      <header className="mb-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <p className="font-semibold text-slate-900 dark:text-slate-50">{title}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</p>
      </header>
      {children}
      {warnings.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-sm text-amber-800 dark:text-amber-200/90">
          {warnings.map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

const incomeLabels: Record<keyof PersonResult["detail"], string> = {
  salaires: "Salaires",
  allocationsChomage: "Allocations chômage",
  autresRevenus: "Autres revenus",
  remunerationsDirigeant: "Rémunération de dirigeant",
  dividendes: "Dividendes",
  benefices: "Bénéfices d'activité"
}

/** Revenus d'un membre du foyer, ventilés par nature ; seules les lignes non nulles sont affichées. */
function PersonIncome({ person, showName }: { person: PersonResult; showName: boolean }) {
  const lines = (Object.keys(incomeLabels) as (keyof PersonResult["detail"])[]).filter(key => person.detail[key] !== 0)
  if (lines.length === 0) return showName ? <p className="text-sm text-slate-600 dark:text-slate-400">{person.name} : aucun revenu</p> : null

  return (
    <div>
      {showName ? <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{person.name}</p> : null}
      <dl className="space-y-1 text-sm">
        {lines.map(key => (
          <Row key={key} label={incomeLabels[key]} value={formatMoney(person.detail[key])} />
        ))}
        {person.fraisProfessionnels ? <FraisProfessionnelsRow frais={person.fraisProfessionnels} /> : null}
      </dl>
    </div>
  )
}

/** Déduction pour frais professionnels d'une personne qui a saisi des frais réels : celle retenue, et l'autre pour comparer. */
function FraisProfessionnelsRow({ frais }: { frais: FraisProfessionnelsResult }) {
  const retenus = frais.retenue === "reels"
  return (
    <>
      <Row
        label={retenus ? "Frais réels retenus" : "Déduction de 10 % retenue"}
        value={`− ${formatMoney(frais.deduction)}`}
        hint={retenus ? `plutôt que ${formatMoney(frais.deductionForfaitaire)} de déduction de 10 %` : `plutôt que ${formatMoney(frais.fraisReels)} de frais réels`}
      />
      {frais.distanceRetenue > 0 ? <Row label={retenus ? "dont trajets domicile-travail" : "trajets domicile-travail"} value={formatMoney(frais.fraisDeTrajet)} hint={`${frais.distanceRetenue.toLocaleString("fr-FR")} km au barème`} /> : null}
    </>
  )
}

/** Taux de prélèvement et part nette d'un foyer : affichés quand la simulation compte plusieurs foyers. */
function FoyerRates({ foyer }: { foyer: FoyerFiscalResult }) {
  const base = foyer.revenusAvantPrelevements
  if (base <= 0) return null
  const percent = (amount: number) => (amount / base).toLocaleString("fr-FR", { style: "percent", maximumFractionDigits: 1 })

  return (
    <dl className="mt-3 space-y-1 border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
      <Row label="Revenus avant prélèvements" value={formatMoney(base)} />
      <Row label="Prélèvements du foyer" value={formatMoney(foyer.totalPrelevements)} hint={percent(foyer.totalPrelevements)} />
      {foyer.resultatConserve !== 0 ? <Row label="Sa part conservée en société" value={formatMoney(foyer.resultatConserve)} hint={percent(foyer.resultatConserve)} /> : null}
      <Row label="Net dans la poche" value={formatMoney(foyer.netApresImpots)} hint={percent(foyer.netApresImpots)} strong />
    </dl>
  )
}

/** Membres d'un foyer, dans l'ordre du foyer. */
function membresDuFoyer(foyer: FoyerFiscalResult, persons: PersonResult[]): PersonResult[] {
  return foyer.personIds.map(id => persons.find(p => p.entityId === id)).filter((p): p is PersonResult => p !== undefined)
}

/** Lignes et compléments d'une carte de foyer ; `cache`, les classes des lignes de détail dans l'affichage classique. */
function piecesDuFoyer(foyer: FoyerFiscalResult, members: PersonResult[], showRates: boolean, cache: string | undefined) {
  return {
    revenus: (
      <div className="mb-2 space-y-2 border-b border-slate-100 pb-2 empty:hidden dark:border-slate-800">
        {members.map(person => (
          <PersonIncome key={person.entityId} person={person} showName={members.length > 1} />
        ))}
      </div>
    ),
    encaisse: <Row label="Total encaissé" value={formatMoney(foyer.revenusEncaisses)} className={cache} />,
    impot: <Row label="Impôt sur le revenu" value={`− ${formatMoney(foyer.impotSurLeRevenu)}`} hint={`sur ${formatMoney(foyer.revenuImposableGlobal)} imposables au barème`} />,
    prelevementsSociaux: foyer.prelevementsSociaux > 0 ? <Row label="Prélèvements sociaux sur dividendes" value={`− ${formatMoney(foyer.prelevementsSociaux)}`} className={cache} /> : null,
    rfr: <Row label="Revenu fiscal de référence" value={formatMoney(foyer.revenuFiscalDeReference)} hint="pour le versement libératoire dans deux ans" />,
    reste: foyer.depenses > 0 ? <Row label="Reste après dépenses saisies" value={formatMoney(foyer.netApresImpots - foyer.depenses)} hint={`${formatMoney(foyer.depenses)} de dépenses`} className={cache} /> : null,
    complements: (
      <>
        {showRates ? <FoyerRates foyer={foyer} /> : null}
        {foyer.optionDividendes ? <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{dividendOptionLabels[foyer.optionDividendes]}</p> : null}
      </>
    )
  }
}

interface FoyerCardProps {
  foyer: FoyerFiscalResult
  persons: PersonResult[]
  showRates: boolean
  /** Nombre de foyers : le bouton du détail les ouvre ou les ferme tous. */
  nombre: number
}

function FoyerCard({ foyer, persons, showRates, nombre }: FoyerCardProps) {
  const resume = useAffichageResume()
  const { ouvert } = useDetailDesCartes()
  const idDuDetail = useId()
  const members = membresDuFoyer(foyer, persons)
  const parts = foyer.totalParts.toLocaleString("fr-FR")
  // Affichage classique : chaque ligne de détail se masque à sa place ; ailleurs, tout le détail, sous le bouton.
  const p = piecesDuFoyer(foyer, members, showRates, resume ? undefined : classeDuDetail(ouvert, "flex"))
  const bouton = <BoutonDuDetailDesCartes nombre={nombre} controle={idDuDetail} className="mt-2" />

  return (
    <Card title={members.map(m => m.name).join(", ")} subtitle={`Foyer fiscal · ${parts} ${foyer.totalParts > 1 ? "parts" : "part"}`} warnings={foyer.warnings}>
      {resume ? (
        // Affichage « Résumé » : l'impôt et le revenu fiscal de référence d'abord. Le net du foyer n'est pas répété :
        // il est dans le bilan, et dans le taux du foyer quand il y en a plusieurs.
        <>
          <dl className="space-y-1 text-sm">
            {p.impot}
            {p.rfr}
          </dl>
          {bouton}
          <div id={idDuDetail} className={cn("text-sm", classeDuDetail(ouvert))}>
            <div className="mt-2">{p.revenus}</div>
            <dl className="space-y-1 text-sm">
              {p.encaisse}
              {p.prelevementsSociaux}
              {p.reste}
            </dl>
            {p.complements}
          </div>
        </>
      ) : (
        <>
          <div id={idDuDetail}>
            <div className={classeDuDetail(ouvert)}>{p.revenus}</div>
            <dl className="space-y-1 text-sm">
              {p.encaisse}
              {p.impot}
              {p.prelevementsSociaux}
              <Row label="Net après impôts" value={formatMoney(foyer.netApresImpots)} strong className={classeDuDetail(ouvert, "flex")} />
              {p.rfr}
              {p.reste}
            </dl>
            <div className={classeDuDetail(ouvert)}>{p.complements}</div>
          </div>
          {bouton}
        </>
      )}
    </Card>
  )
}

/** Seuil d'accès au versement libératoire d'une micro-entreprise, et situation du foyer par rapport à ce seuil. */
function VersementLiberatoireNote({ info }: { info: VersementLiberatoireInfo }) {
  const parts = info.partsFiscales.toLocaleString("fr-FR")
  const origine = info.origineRfr === "calcule" ? "calculé par la simulation" : "saisi dans la fiche"
  const rfr = `votre RFR ${info.anneeRfr} de ${formatMoney(info.rfrN2 ?? 0)}, ${origine},`
  const status = info.eligible === null ? `RFR ${info.anneeRfr} inconnu : ajoutez l'année ${info.anneeRfr} à la simulation ou renseignez-le dans la fiche de la micro-entreprise` : `${rfr} ${info.eligible ? "y donne accès" : "le dépasse"}`

  return (
    <div className="mt-3 border-t border-slate-100 pt-2 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
      <p>
        <span className="font-medium text-slate-700 dark:text-slate-200">Versement libératoire</span> {info.applique ? "(appliqué)" : "(non appliqué)"} : seuil de {formatMoney(info.plafondRfr)} de revenu fiscal de référence {info.anneeRfr} pour {parts} {info.partsFiscales > 1 ? "parts" : "part"} ;{" "}
        <span className={info.eligible === false ? "text-rose-700 dark:text-rose-400" : info.eligible ? "text-emerald-700 dark:text-emerald-400" : undefined}>{status}</span>.
      </p>
    </div>
  )
}

/** Coût employeur des salariés d'une activité : salaires bruts, plus cotisations patronales, moins la réduction générale. */
function EmployerCost({ salaries, className }: { salaries: SalarieDeLActivite[]; className?: string }) {
  const sum = (value: (salarie: SalarieDeLActivite) => number) => salaries.reduce((total, salarie) => total + value(salarie), 0)
  const hint = `${formatMoney(sum(s => s.brut))} bruts + ${formatMoney(sum(s => s.totalPatronal))} de cotisations patronales − ${formatMoney(sum(s => s.reductionGenerale))} de réduction générale`
  return <Row label={salaries.length > 1 ? `Coût employeur des ${salaries.length} salariés` : "Coût employeur du salarié"} value={formatMoney(sum(s => s.coutEmployeur))} hint={hint} className={className} />
}

/** Déplacements professionnels convertis au barème kilométrique, déjà compris dans les charges ou les dépenses. */
function DeplacementsRow({ deplacements, className }: { deplacements: NonNullable<ActivityResult["fraisDeDeplacement"]>; className?: string }) {
  const kilometres = `${deplacements.kilometres.toLocaleString("fr-FR")} km au barème kilométrique`
  return <Row label="dont déplacements professionnels" value={formatMoney(deplacements.montant)} hint={deplacements.deductible ? `${kilometres}, déductibles` : `${kilometres}, non déductibles`} className={className} />
}

/**
 * Dispositifs limités dans le temps qui jouent cette année (sortie du régime micro, ACRE, plafonds au prorata) : une
 * information sur le calcul, toujours visible, distincte des avertissements.
 */
export function NotesDesDispositifs({ notes, className }: { notes: string[] | undefined; className?: string }) {
  if (!notes?.length) return null
  return (
    <ul aria-label="Dispositifs de l'année" className={cn("mb-2 space-y-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100", className)}>
      {notes.map(note => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  )
}

/** Statut affiché sous le nom : celui de l'année, et la sortie du régime micro quand elle a eu lieu. */
function statutAffiche(activity: ActivityResult): string {
  return activity.sortieDuRegimeMicro ? `${activity.statut} · sortie du régime micro au 1er janvier ${activity.sortieDuRegimeMicro.depuis}` : activity.statut
}

function ActivityCard({ activity, nombre }: { activity: ActivityResult; nombre: number }) {
  const resume = useAffichageResume()
  const { ouvert } = useDetailDesCartes()
  const idDuDetail = useId()
  const verse = <Row label="Versé avant impôt sur le revenu" value={formatMoney(activity.revenuVerse)} hint={shareOfRevenue(activity)} strong />
  const versementLiberatoire = activity.versementLiberatoire ? <VersementLiberatoireNote info={activity.versementLiberatoire} /> : null
  const bouton = <BoutonDuDetailDesCartes nombre={nombre} controle={idDuDetail} className="mt-2" />

  return (
    <Card title={activity.name} subtitle={statutAffiche(activity)} warnings={activity.warnings}>
      <NotesDesDispositifs notes={activity.dispositifs} />
      {resume ? (
        // Affichage « Résumé » : ce que l'activité verse d'abord, le calcul replié.
        <>
          <dl className="text-sm">
            {verse}
            <ReservesALaFin activity={activity} />
          </dl>
          {bouton}
          <div id={idDuDetail} className={classeDuDetail(ouvert)}>
            <dl className="mt-2 space-y-1 text-sm">
              <LignesDeLActivite activity={activity} />
            </dl>
            {versementLiberatoire}
          </div>
        </>
      ) : (
        // Affichage classique : le calcul ligne à ligne, chaque ligne masquée à sa place quand le détail est fermé.
        <>
          <div id={idDuDetail}>
            <dl className="space-y-1 text-sm">
              <LignesDeLActivite activity={activity} className={classeDuDetail(ouvert, "flex")} />
              {verse}
              <ReservesALaFin activity={activity} />
            </dl>
            <div className={classeDuDetail(ouvert)}>{versementLiberatoire}</div>
          </div>
          {bouton}
        </>
      )}
    </Card>
  )
}

/** Du chiffre d'affaires au résultat conservé : le calcul de ce que l'activité verse. */
function LignesDeLActivite({ activity, className }: { activity: ActivityResult; className?: string }) {
  const isMicro = activity.type === "micro-entreprise"
  return (
    <>
      <Row label="Chiffre d'affaires" value={formatMoney(activity.chiffreAffaires)} className={className} />
      {activity.charges > 0 ? <Row label={isMicro ? "Dépenses (non déductibles)" : "Charges déductibles"} value={`− ${formatMoney(activity.charges)}`} className={className} /> : null}
      {activity.fraisDeDeplacement ? <DeplacementsRow deplacements={activity.fraisDeDeplacement} className={className} /> : null}
      <Row label="Cotisations sociales" value={`− ${formatMoney(activity.cotisationsSociales)}`} className={className} />
      {activity.cotisationsPresident ? <Row label="Coût de la rémunération du président" value={formatMoney(activity.cotisationsPresident.coutEmployeur)} hint={`dont ${formatMoney(activity.cotisationsPresident.brut)} bruts`} className={className} /> : null}
      {activity.salaries?.length ? <EmployerCost salaries={activity.salaries} className={className} /> : null}
      {activity.impotSocietes > 0 ? <Row label="Impôt sur les sociétés" value={`− ${formatMoney(activity.impotSocietes)}`} className={className} /> : null}
      {activity.reserves ? <MouvementsDesReserves activity={activity} className={className} /> : null}
    </>
  )
}

/**
 * Société à l'IS : ce que ses réserves gagnent ou perdent dans l'année (bénéfice gardé, dividendes pris sur les
 * réserves, déficit) et le déficit des années précédentes déduit avant l'IS (voir l'ADR 014).
 */
function MouvementsDesReserves({ activity, className }: { activity: ActivityResult; className?: string }) {
  const lecture = lectureDesReserves(activity)
  if (!lecture) return null
  const { ajoutees, reserveLegaleDotee, prisesSurLesReserves, deficit, deficitImpute } = lecture
  return (
    <>
      {deficitImpute >= 0.5 ? <Row label="Déficit des années précédentes déduit" value={formatMoney(deficitImpute)} hint="avant l'impôt sur les sociétés" className={className} /> : null}
      {deficit >= 0.5 ? <Row label="Déficit de la société" value={`− ${formatMoney(deficit)}`} hint="pris sur les réserves, déduit des bénéfices suivants" className={className} /> : null}
      {ajoutees >= 0.5 ? <Row label="Ajouté aux réserves" value={formatMoney(ajoutees)} hint={reserveLegaleDotee >= 0.5 ? `dont ${formatMoney(reserveLegaleDotee)} de réserve légale` : null} className={className} /> : null}
      {prisesSurLesReserves >= 0.5 ? <Row label="Dividendes pris sur les réserves" value={`− ${formatMoney(prisesSurLesReserves)}`} className={className} /> : null}
    </>
  )
}

/** Société à l'IS : ses réserves distribuables au 31 décembre, cumulées depuis le début de la simulation. */
function ReservesALaFin({ activity }: { activity: ActivityResult }) {
  const lecture = lectureDesReserves(activity)
  if (!lecture?.aSignaler) return null
  const label = lecture.aLaFin < 0 ? "Pertes à combler au 31 décembre" : "Réserves au 31 décembre"
  return <Row label={label} value={formatMoney(Math.abs(lecture.aLaFin))} hint={lecture.reserveLegale >= 0.5 ? `plus ${formatMoney(lecture.reserveLegale)} de réserve légale` : null} />
}

/** Titre des résultats, année et règles appliquées, et avertissements propres à l'année (règles reprises d'une autre année). */
function EnTeteDesResultats({ report }: { report: SimulationReport | null }) {
  return (
    <>
      <div>
        <h2 id="resultats-titre" className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
          Résultats de simulation
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Recalculés à chaque modification{report ? `, année ${report.annee} avec les règles fiscales ${report.anneeDesRegles}` : ""}. Estimations simplifiées, non validées par un expert-comptable.
        </p>
      </div>

      {report?.avertissements.length ? (
        <ul className="list-inside list-disc rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {report.avertissements.map(avertissement => (
            <li key={avertissement}>{avertissement}</li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

/** Sociétés dont les revenus se partagent entre plusieurs personnes : seule situation où la répartition à parts égales s'applique. */
function NoteDesAssocies({ sharedCompanies }: { sharedCompanies: ActivityResult[] }) {
  if (sharedCompanies.length === 0) return null
  return (
    <ReplieEnResume titre="Sociétés à plusieurs associés" id="societes-a-plusieurs-associes" className="text-sm text-slate-600 dark:text-slate-400">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {sharedCompanies.map(a => `« ${a.name} »`).join(", ")} : l'impôt sur les sociétés et le bénéfice conservé sont partagés à parts égales entre les associés, comme les dividendes. La répartition réelle du capital n'est pas encore modélisée.
      </p>
    </ReplieEnResume>
  )
}

/** Les cartes des foyers fiscaux ; le bouton du détail de chacune compte toutes les cartes de la page. */
function cartesDesFoyers(report: SimulationReport) {
  return report.foyers.map(foyer => <FoyerCard key={foyer.personIds.join("-")} foyer={foyer} persons={report.persons} showRates={report.foyers.length > 1} nombre={report.foyers.length + report.activities.length} />)
}

/** Les cartes des activités. */
function cartesDesActivites(report: SimulationReport) {
  return report.activities.map(activity => <ActivityCard key={activity.entityId} activity={activity} nombre={report.foyers.length + report.activities.length} />)
}

const GRILLE_DES_CARTES = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
const TITRE_DES_CARTES = "text-lg font-medium text-slate-800 dark:text-slate-100"

/** Affichage « Résumé » : les cartes des foyers et des activités, réduites à leur chiffre clé, dans une seule grille. */
function CartesDuResume({ report, sharedCompanies }: { report: SimulationReport; sharedCompanies: ActivityResult[] }) {
  if (report.foyers.length + report.activities.length === 0) return null
  return (
    <div className="space-y-3">
      <h3 className={TITRE_DES_CARTES}>Par foyer fiscal et par activité</h3>
      <NoteDesAssocies sharedCompanies={sharedCompanies} />
      <div className={GRILLE_DES_CARTES}>
        {cartesDesFoyers(report)}
        {cartesDesActivites(report)}
      </div>
    </div>
  )
}

/** Affichage classique : les cartes des foyers, puis celles des activités. */
function CartesClassiques({ report, sharedCompanies }: { report: SimulationReport; sharedCompanies: ActivityResult[] }) {
  return (
    <>
      {report.foyers.length > 0 ? (
        <div className="space-y-3">
          <h3 className={TITRE_DES_CARTES}>Par foyer fiscal</h3>
          <NoteDesAssocies sharedCompanies={sharedCompanies} />
          <div className={GRILLE_DES_CARTES}>{cartesDesFoyers(report)}</div>
        </div>
      ) : null}

      {report.activities.length > 0 ? (
        <div className="space-y-3">
          <h3 className={TITRE_DES_CARTES}>Par activité</h3>
          <div className={GRILLE_DES_CARTES}>{cartesDesActivites(report)}</div>
        </div>
      ) : null}
    </>
  )
}

export function ResultsPanel({ report, error, apresLeBilan }: ResultsPanelProps) {
  // L'affichage classique a deux grilles de cartes, l'affichage « Résumé » une seule.
  const Cartes = useAffichageResume() ? CartesDuResume : CartesClassiques
  // Sociétés dont les revenus se partagent entre plusieurs personnes : seule situation où la répartition à parts égales s'applique.
  const sharedCompanies = report?.activities.filter(a => a.type === "company" && a.beneficiaireIds.length > 1) ?? []

  return (
    <section className="mt-12 space-y-6">
      <EnTeteDesResultats report={report} />

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p> : null}

      {report && report.foyers.length + report.activities.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-400">Ajoutez une personne ou une activité pour voir les résultats.</p> : null}

      {report && report.foyers.length + report.activities.length > 0 ? <BilanCard report={report} /> : null}

      {apresLeBilan}

      {/* Le détail des cartes s'ouvre et se ferme pour toutes à la fois, foyers et activités. */}
      {report ? (
        <FournisseurDesDetails>
          <Cartes report={report} sharedCompanies={sharedCompanies} />
        </FournisseurDesDetails>
      ) : null}
    </section>
  )
}
