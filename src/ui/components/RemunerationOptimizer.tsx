// src/ui/components/RemunerationOptimizer.tsx
// Arbitrage rémunération / dividendes : courbe du net du foyer selon la rémunération du dirigeant, en SASU ou en EURL,
// avec la meilleure rémunération et la meilleure parmi celles qui valident 4 trimestres de retraite.

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { Button } from "@/components/ui/button"
import { echelle, graduations, indiceLePlusProche, montantCourt, positionInfoBulle } from "@/lib/graphique"
import { cn } from "@/lib/utils"
import type { ComparaisonOptions, OptimisationRemuneration, PointRemuneration, SessionState, StatutSociete } from "@/types"
import { exporterCourbeCsv } from "../exports-texte"
import { BoutonExportCsv } from "./BoutonExportCsv"
import { Depliable } from "./Depliable"
import { ZoneDefilante } from "./ZoneDefilante"

const STATUTS: StatutSociete[] = ["SASU", "EURL"]

const euros = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`
const trimestres = (n: number) => `${n} trimestre${n > 1 ? "s" : ""} de retraite`

/** Recalcule la courbe peu après chaque changement ; la rémunération choisie dans le comparateur n'y change rien. */
function useOptimisation(session: SessionState, options: ComparaisonOptions, statut: StatutSociete) {
  const [resultat, setResultat] = useState<OptimisationRemuneration | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const { activityId, partBncPrestations, fraisFonctionnement } = options

  useEffect(() => {
    let annule = false
    const minuteur = setTimeout(async () => {
      try {
        const optimisation = await window.api.optimiserRemuneration(session, { activityId, partBncPrestations, fraisFonctionnement, remunerationNette: 0, distribuerToutLeBenefice: true }, statut)
        if (annule) return
        setResultat(optimisation)
        setErreur(null)
      } catch (e) {
        if (!annule) setErreur(e instanceof Error ? e.message : "L'optimisation a échoué.")
      }
    }, 300)
    return () => {
      annule = true
      clearTimeout(minuteur)
    }
  }, [session, activityId, partBncPrestations, fraisFonctionnement, statut])

  return { resultat, erreur }
}

/** Largeur réelle du conteneur, pour dessiner le graphique à l'échelle 1 : le texte garde sa taille sur téléphone. */
function useLargeur(defaut: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [largeur, setLargeur] = useState(defaut)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === "undefined") return
    const observateur = new ResizeObserver(([entree]) => setLargeur(Math.round(entree.contentRect.width)))
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [])
  return { ref, largeur }
}

function ChoixDuStatut({ statut, onChange }: { statut: StatutSociete; onChange: (statut: StatutSociete) => void }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 p-0.5 dark:border-slate-600" role="group" aria-label="Statut de la société">
      {STATUTS.map(s => (
        <button key={s} type="button" aria-pressed={s === statut} onClick={() => onChange(s)} className={cn("min-h-9 min-w-16 rounded px-3 text-sm font-medium pointer-coarse:min-h-11", s === statut ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800")}>
          {s}
        </button>
      ))}
    </div>
  )
}

interface ResumeProps {
  resultat: OptimisationRemuneration
  remunerationActuelle: number
  onAppliquer: (remunerationNette: number) => void
}

/** Les deux rémunérations à retenir, en phrases, chacune avec un bouton pour la reporter dans le comparateur. */
function Resume({ resultat, remunerationActuelle, onAppliquer }: ResumeProps) {
  const { meilleur, meilleurAvecRetraite, statut } = resultat
  if (!meilleur) return null
  const memePoint = meilleurAvecRetraite?.remunerationNette === meilleur.remunerationNette

  const ligne = (titre: string, point: PointRemuneration, detail?: string) => (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700">
      <p>
        <span className="font-semibold">{titre} : </span>
        {euros(point.netApresImpots)} dans la poche du foyer, avec {euros(point.remunerationNette)} de rémunération nette et {euros(point.dividendes)} de dividendes ({trimestres(point.trimestres)}).
        {detail ? <span className="text-slate-600 dark:text-slate-300"> {detail}</span> : null}
      </p>
      <Button variant="outline" size="sm" className="min-h-9" disabled={remunerationActuelle === point.remunerationNette} onClick={() => onAppliquer(point.remunerationNette)}>
        {remunerationActuelle === point.remunerationNette ? "Appliquée" : "Appliquer au comparateur"}
      </Button>
    </li>
  )

  return (
    <ul className="space-y-2 text-sm">
      {ligne(memePoint ? "Meilleur net, 4 trimestres validés" : "Meilleur net", meilleur)}
      {meilleurAvecRetraite && !memePoint ? ligne("Meilleur net avec 4 trimestres", meilleurAvecRetraite, `Soit ${euros(meilleur.netApresImpots - meilleurAvecRetraite.netApresImpots)} de moins par an pour valider une année de retraite.`) : null}
      {!meilleurAvecRetraite ? <li className="px-1 text-slate-600 dark:text-slate-300">Aucune rémunération possible en {statut} ne valide 4 trimestres de retraite.</li> : null}
    </ul>
  )
}

const MARGES = { haut: 28, droite: 16, bas: 36, gauche: 60 }
const HAUTEUR = 260

interface CourbeProps {
  resultat: OptimisationRemuneration
  remunerationActuelle: number
}

/** Courbe du net du foyer selon la rémunération, avec survol (pointeur ou flèches du clavier). */
function Courbe({ resultat, remunerationActuelle }: CourbeProps) {
  const { ref, largeur } = useLargeur(640)
  const [survol, setSurvol] = useState<number | null>(null)
  const { points, meilleur, meilleurAvecRetraite, remunerationMaximale } = resultat

  const nets = points.map(p => p.netApresImpots)
  const ticksY = graduations(Math.min(...nets), Math.max(...nets), 4)
  const ticksX = graduations(0, remunerationMaximale, largeur < 480 ? 3 : 5).filter(t => t <= remunerationMaximale)
  const x = echelle([0, Math.max(1, remunerationMaximale)], [MARGES.gauche, largeur - MARGES.droite])
  const y = echelle([ticksY[0], ticksY[ticksY.length - 1]], [HAUTEUR - MARGES.bas, MARGES.haut])
  const trace = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.remunerationNette).toFixed(1)},${y(p.netApresImpots).toFixed(1)}`).join(" ")
  const seuilRetraite = points.find(p => p.trimestres >= 4)?.remunerationNette

  const choisir = (remuneration: number) => setSurvol(indiceLePlusProche(points.map(p => p.remunerationNette), remuneration))
  const surPointeur = (e: PointerEvent<SVGRectElement>) => {
    const cadre = e.currentTarget.getBoundingClientRect()
    choisir(((e.clientX - cadre.left) / cadre.width) * remunerationMaximale)
  }
  const surClavier = (e: KeyboardEvent<HTMLDivElement>) => {
    const pas = { ArrowLeft: -1, ArrowRight: 1, Home: -points.length, End: points.length }[e.key]
    if (pas === undefined) return
    e.preventDefault()
    setSurvol(i => Math.min(points.length - 1, Math.max(0, (i ?? points.indexOf(meilleur!)) + pas)))
  }
  const pointSurvole = survol === null ? null : points[survol]

  return (
    <div ref={ref} className="relative">
      <div tabIndex={0} role="group" aria-label={`Net du foyer selon la rémunération nette en ${resultat.statut}. Flèches gauche et droite pour parcourir la courbe.`} onKeyDown={surClavier} onBlur={() => setSurvol(null)} className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
        <svg width={largeur} height={HAUTEUR} className="block overflow-visible text-xs" aria-hidden>
          {seuilRetraite !== undefined && seuilRetraite > 0 ? (
            <g>
              <rect x={MARGES.gauche} y={MARGES.haut} width={x(seuilRetraite) - MARGES.gauche} height={HAUTEUR - MARGES.haut - MARGES.bas} className="fill-slate-500/10" />
              <text x={MARGES.gauche + 6} y={HAUTEUR - MARGES.bas - 8} className="fill-slate-600 dark:fill-slate-300">
                Moins de 4 trimestres
              </text>
            </g>
          ) : null}

          {ticksY.map(t => (
            <g key={t}>
              <line x1={MARGES.gauche} x2={largeur - MARGES.droite} y1={y(t)} y2={y(t)} className="stroke-slate-200 dark:stroke-slate-700" strokeWidth={1} />
              <text x={MARGES.gauche - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-slate-600 tabular-nums dark:fill-slate-300">
                {montantCourt(t)}
              </text>
            </g>
          ))}
          {ticksX.map(t => (
            <text key={t} x={x(t)} y={HAUTEUR - MARGES.bas + 18} textAnchor="middle" className="fill-slate-600 tabular-nums dark:fill-slate-300">
              {montantCourt(t)}
            </text>
          ))}
          <text x={largeur - MARGES.droite} y={HAUTEUR - 4} textAnchor="end" className="fill-slate-600 dark:fill-slate-300">
            Rémunération nette annuelle
          </text>

          {remunerationActuelle <= remunerationMaximale ? <line x1={x(remunerationActuelle)} x2={x(remunerationActuelle)} y1={MARGES.haut} y2={HAUTEUR - MARGES.bas} className="stroke-slate-400 dark:stroke-slate-500" strokeWidth={1} /> : null}

          <path d={trace} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-blue-600 dark:stroke-blue-500" />

          {pointSurvole ? <line x1={x(pointSurvole.remunerationNette)} x2={x(pointSurvole.remunerationNette)} y1={MARGES.haut} y2={HAUTEUR - MARGES.bas} className="stroke-slate-500" strokeWidth={1} /> : null}

          {meilleurAvecRetraite && meilleurAvecRetraite !== meilleur ? <Repere point={meilleurAvecRetraite} x={x} y={y} classe="fill-violet-600 dark:fill-violet-500" libelle="4 trimestres" largeur={largeur} /> : null}
          {meilleur ? <Repere point={meilleur} x={x} y={y} classe="fill-emerald-600" libelle="Meilleur net" largeur={largeur} /> : null}

          <rect x={MARGES.gauche} y={MARGES.haut} width={Math.max(0, largeur - MARGES.gauche - MARGES.droite)} height={HAUTEUR - MARGES.haut - MARGES.bas} fill="transparent" className="cursor-crosshair" onPointerMove={surPointeur} onPointerLeave={() => setSurvol(null)} />
        </svg>
      </div>
      {pointSurvole ? <InfoBulle point={pointSurvole} gauche={x(pointSurvole.remunerationNette)} largeur={largeur} /> : null}
    </div>
  )
}

interface RepereProps {
  point: PointRemuneration
  x: (v: number) => number
  y: (v: number) => number
  classe: string
  libelle: string
  largeur: number
}

/** Point remarquable de la courbe : pastille avec un anneau de la couleur du fond, et son libellé. */
function Repere({ point, x, y, classe, libelle, largeur }: RepereProps) {
  const cx = x(point.remunerationNette)
  const aDroite = cx < largeur - 120
  return (
    <g>
      <circle cx={cx} cy={y(point.netApresImpots)} r={6} strokeWidth={2} className={cn("stroke-white dark:stroke-gray-950", classe)} />
      <text x={aDroite ? cx + 10 : cx - 10} y={y(point.netApresImpots) - 10} textAnchor={aDroite ? "start" : "end"} className="fill-slate-800 font-semibold dark:fill-slate-100">
        {libelle}
      </text>
    </g>
  )
}

const LARGEUR_INFOBULLE = 208

function InfoBulle({ point, gauche, largeur }: { point: PointRemuneration; gauche: number; largeur: number }) {
  return (
    <div role="status" className="pointer-events-none absolute top-2 z-10 rounded-md border border-slate-200 bg-white p-3 text-sm shadow-md dark:border-slate-700 dark:bg-gray-900" style={{ left: positionInfoBulle(gauche, largeur, LARGEUR_INFOBULLE), width: LARGEUR_INFOBULLE }}>
      <p className="text-base font-semibold tabular-nums">{euros(point.netApresImpots)}</p>
      <p className="text-slate-600 dark:text-slate-300">dans la poche du foyer</p>
      <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
        <dt className="text-slate-600 dark:text-slate-300">Rémunération</dt>
        <dd className="text-right">{euros(point.remunerationNette)}</dd>
        <dt className="text-slate-600 dark:text-slate-300">Dividendes</dt>
        <dd className="text-right">{euros(point.dividendes)}</dd>
        <dt className="text-slate-600 dark:text-slate-300">Retraite</dt>
        <dd className="text-right">{point.trimestres} trim.</dd>
      </dl>
    </div>
  )
}

/** Les valeurs de la courbe, pour qui ne peut pas la lire : une quinzaine de points, et les deux rémunérations retenues. */
function TableDesValeurs({ resultat, onExporter }: { resultat: OptimisationRemuneration; onExporter: () => void }) {
  const { points, meilleur, meilleurAvecRetraite } = resultat
  const pas = Math.max(1, Math.ceil(points.length / 15))
  const lignes = points.filter((p, i) => i % pas === 0 || i === points.length - 1 || p === meilleur || p === meilleurAvecRetraite)
  return (
    <Depliable titre="Valeurs de la courbe" className="text-sm text-slate-700 dark:text-slate-200">
      {/* L'export contient tous les points de la courbe, pas seulement ceux du tableau. */}
      <div className="mt-3 flex justify-end">
        <BoutonExportCsv contenu="toutes les valeurs de la courbe" onClick={onExporter} />
      </div>
      <ZoneDefilante libelle="Tableau des valeurs de la courbe" className="mt-3">
        <table className="w-full min-w-[36rem] text-sm tabular-nums" aria-label={`Net du foyer selon la rémunération en ${resultat.statut}`}>
          <thead>
            <tr className="text-right text-slate-600 dark:text-slate-300">
              <th scope="col" className="py-1 pr-3 font-medium">Rémunération nette</th>
              <th scope="col" className="py-1 pr-3 font-medium">Dividendes</th>
              <th scope="col" className="py-1 pr-3 font-medium">Net du foyer</th>
              <th scope="col" className="py-1 pr-3 font-medium">Cotisations</th>
              <th scope="col" className="py-1 pr-3 font-medium">Impôts</th>
              <th scope="col" className="py-1 font-medium">Trimestres</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(p => (
              <tr key={p.remunerationNette} className={cn("border-t border-slate-200 text-right dark:border-slate-700", p === meilleur && "font-semibold")}>
                <td className="py-1 pr-3">{euros(p.remunerationNette)}</td>
                <td className="py-1 pr-3">{euros(p.dividendes)}</td>
                <td className="py-1 pr-3">{euros(p.netApresImpots)}</td>
                <td className="py-1 pr-3">{euros(p.cotisationsSociales)}</td>
                <td className="py-1 pr-3">{euros(p.impotSocietes + p.impotSurLeRevenu + p.prelevementsSociaux)}</td>
                <td className="py-1">{p.trimestres}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ZoneDefilante>
    </Depliable>
  )
}

interface RemunerationOptimizerProps {
  session: SessionState
  options: ComparaisonOptions
  activityName: string
  statutInitial: StatutSociete
  onAppliquer: (remunerationNette: number) => void
}

export function RemunerationOptimizer({ session, options, activityName, statutInitial, onAppliquer }: RemunerationOptimizerProps) {
  const [statut, setStatut] = useState<StatutSociete>(statutInitial)
  const { resultat, erreur } = useOptimisation(session, options, statut)
  const aJour = resultat?.statut === statut

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700" aria-labelledby="optimisation-titre">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="optimisation-titre" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Rémunération ou dividendes ?
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">« {activityName} » en société : chaque rémunération nette, le reste du bénéfice étant versé en dividendes. Le trait vertical marque la rémunération du comparateur.</p>
        </div>
        <ChoixDuStatut statut={statut} onChange={setStatut} />
      </div>

      {erreur ? <p className="text-sm text-red-700 dark:text-red-300">{erreur}</p> : null}
      {resultat && aJour && resultat.warnings.length > 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">{resultat.warnings.join(" ")}</p> : null}
      {resultat && aJour && resultat.points.length > 0 ? (
        <>
          <Resume resultat={resultat} remunerationActuelle={options.remunerationNette} onAppliquer={onAppliquer} />
          <Courbe resultat={resultat} remunerationActuelle={options.remunerationNette} />
          <TableDesValeurs resultat={resultat} onExporter={() => exporterCourbeCsv(session, resultat, activityName)} />
        </>
      ) : null}
    </section>
  )
}
