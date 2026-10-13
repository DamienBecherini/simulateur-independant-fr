// src/ui/components/BarreDeResume.tsx
// Affichage « Résumé » (proposition A de l'étude d'allègement de l'écran) : les chiffres clés de l'année, toujours
// visibles sous la barre d'outils et recalculés à chaque modification. Chacun mène à son détail, comme les réponses du
// comparateur quand elles existent (mariage ou Pacs, rémunération optimale).
//
// Sur un téléphone, une fois la page défilée, la barre se réduit à une ligne (année, net, meilleur statut) pour laisser
// l'écran au contenu ; un bouton la déplie (taux, réponses, alertes, libellés entiers). Le reste de la page ne bouge pas :
// la barre garde sa hauteur pleine dans le flux, la place libérée restant transparente.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { ChevronDown, Trophy } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ANCRE_DE_LA_REMUNERATION, ANCRE_DU_COUPLE, gainDuMariageOuDuPacs, meilleurStatut, nombreDAlertes, remunerationOptimale, tauxDePrelevement, type ResumeDeLaComparaison } from "@/lib/resume"
import { ecartSigne, euros } from "@/backend/logic/format"
import type { SimulationReport } from "@/types"
import { useVuesDeLaPage } from "../hooks/useVues"
import { OngletsDesVues } from "./VuesDeLaPage"

interface BarreDeResumeProps {
  report: SimulationReport | null
  annees: number[]
  annee: number
  onAnnee: (annee: number) => void
  comparaison: ResumeDeLaComparaison | null
}

/**
 * Colle la barre sous la barre d'outils (fixe, de hauteur variable avec le zoom), et réserve leurs deux hauteurs en
 * haut de la fenêtre : un lien suivi ou un élément qui reçoit le focus n'est jamais caché dessous (WCAG 2.4.11).
 */
function useSousLaBarreDOutils(barre: RefObject<HTMLElement | null>): number {
  const [haut, setHaut] = useState(0)
  useEffect(() => {
    const outils = document.querySelector<HTMLElement>("nav[aria-label=\"Barre d'outils\"]")
    const racine = document.documentElement
    const mesurer = () => {
      const hauteurOutils = outils?.offsetHeight ?? 0
      const hautCollant = hauteurOutils + (barre.current?.offsetHeight ?? 0) + 8
      setHaut(hauteurOutils)
      racine.style.scrollPaddingTop = `${hautCollant}px`
      // Lue par la feuille de style : les éléments des barres elles-mêmes échappent à cette réserve (voir App.css).
      racine.style.setProperty("--hauteur-collee", `${hautCollant}px`)
    }
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    if (outils) observateur.observe(outils)
    if (barre.current) observateur.observe(barre.current)
    return () => {
      observateur.disconnect()
      racine.style.scrollPaddingTop = ""
      racine.style.removeProperty("--hauteur-collee")
    }
  }, [barre])
  return haut
}

/**
 * La barre est-elle collée en haut (page défilée au-delà de sa place) ? Le repère, un élément vide juste avant elle,
 * reste à sa place dans le flux : la barre est collée dès qu'il passe sous la barre d'outils.
 */
function useCollee(repere: RefObject<HTMLElement | null>, haut: number): boolean {
  const [collee, setCollee] = useState(false)
  useEffect(() => {
    let image = 0
    const mesurer = () => {
      image = 0
      const element = repere.current
      if (element) setCollee(element.getBoundingClientRect().top < haut - 1)
    }
    const auDefilement = () => {
      image ||= requestAnimationFrame(mesurer)
    }
    mesurer()
    window.addEventListener("scroll", auDefilement, { passive: true })
    window.addEventListener("resize", auDefilement)
    return () => {
      window.removeEventListener("scroll", auDefilement)
      window.removeEventListener("resize", auDefilement)
      cancelAnimationFrame(image)
    }
  }, [repere, haut])
  return collee
}

/** Hauteur imposée à un élément (vide : sa hauteur naturelle). */
function poserLaHauteur(element: HTMLElement, hauteur: string) {
  element.style.height = hauteur
}

/**
 * Garde à la barre, dans le flux, sa hauteur pleine quand elle se réduit : le conteneur collant garde cette hauteur,
 * sa partie vide est transparente et laisse passer les clics. Le contenu de la page ne bouge donc jamais, ni quand la
 * barre se réduit, ni quand elle se déplie (et le navigateur n'a pas à le recaler en faisant défiler la page).
 * La hauteur pleine est mesurée tant que la barre est entière ; réduite, elle est posée sans rien mesurer.
 */
function useHauteurReservee(barre: RefObject<HTMLElement | null>, reduite: boolean) {
  const pleine = useRef(0)
  const reduiteMaintenant = useRef(reduite)
  useLayoutEffect(() => {
    reduiteMaintenant.current = reduite
    const element = barre.current
    if (!element) return
    if (reduite) return poserLaHauteur(element, `${pleine.current}px`)
    poserLaHauteur(element, "")
    pleine.current = element.offsetHeight
  })
  useEffect(() => {
    const element = barre.current
    if (!element) return
    const observateur = new ResizeObserver(() => {
      if (!reduiteMaintenant.current) pleine.current = element.offsetHeight
    })
    observateur.observe(element)
    return () => observateur.disconnect()
  }, [barre])
}

interface ChiffreProps {
  vers: string
  libelle: string
  libelleCourt?: string
  valeur: ReactNode
  className?: string
  /** Barre réduite, sur un téléphone : une icône à la place du libellé court (lu quand même), la valeur coupée au besoin. */
  icone?: ReactNode
}

/** Un chiffre clé : un lien vers son détail, au libellé complet pour les lecteurs d'écran. */
function Chiffre({ vers, libelle, libelleCourt, valeur, className, icone }: ChiffreProps) {
  return (
    <a href={`#${vers}`} className={cn("inline-flex min-h-6 items-baseline gap-1.5 rounded-sm underline-offset-2 hover:underline pointer-coarse:min-h-11 pointer-coarse:items-center", icone && "max-sm:min-w-0 max-sm:items-center", className)}>
      {icone ? <span aria-hidden className="shrink-0 text-slate-600 sm:hidden dark:text-slate-300 [&_svg]:size-4">{icone}</span> : null}
      <span className={cn("text-slate-600 dark:text-slate-300", libelleCourt && "max-sm:hidden")}>{libelle}</span>
      {libelleCourt ? <span className={cn("text-slate-600 sm:hidden dark:text-slate-300", icone && "sr-only")}>{libelleCourt}</span> : null}
      <span title={icone && typeof valeur === "string" ? valeur : undefined} className={cn("font-semibold tabular-nums text-slate-900 dark:text-slate-50", icone && "max-sm:truncate")}>
        {valeur}
      </span>
      <span className="sr-only">, voir le détail</span>
    </a>
  )
}

/** Année affichée : un choix quand la session en compte plusieurs, sinon un simple rappel. */
function ChoixDeLAnnee({ annees, annee, onAnnee }: Pick<BarreDeResumeProps, "annees" | "annee" | "onAnnee">) {
  if (annees.length < 2) return <span className="font-semibold tabular-nums">{annee}</span>
  return (
    <Select value={String(annee)} onValueChange={valeur => onAnnee(Number(valeur))}>
      <SelectTrigger size="sm" aria-label="Année affichée" className="h-7 bg-background px-2 font-semibold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {annees.map(a => (
          <SelectItem key={a} value={String(a)}>
            {a}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Le bouton qui déplie la barre réduite ; il dit combien d'alertes elle cache. */
function BoutonDuDetail({ deplie, alertes, onBasculer }: { deplie: boolean; alertes: number; onBasculer: () => void }) {
  const nom = alertes > 0 ? `Taux et alertes (${alertes} ${alertes > 1 ? "alertes" : "alerte"})` : "Taux et alertes"
  return (
    <button type="button" aria-label={nom} aria-expanded={deplie} onClick={onBasculer} className="ml-auto inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center gap-0.5 rounded-md text-slate-700 hover:bg-blue-100 pointer-coarse:min-h-11 pointer-coarse:min-w-11 sm:hidden dark:text-slate-200 dark:hover:bg-slate-800">
      {alertes > 0 && !deplie ? (
        <span aria-hidden className="rounded-full bg-amber-200 px-1.5 text-xs font-semibold text-amber-950 dark:bg-amber-800 dark:text-amber-50">
          {alertes}
        </span>
      ) : null}
      <ChevronDown aria-hidden className={cn("size-5 motion-safe:transition-transform", deplie && "rotate-180")} />
    </button>
  )
}

export function BarreDeResume({ report, annees, annee, onAnnee, comparaison }: BarreDeResumeProps) {
  const barre = useRef<HTMLDivElement>(null)
  const repere = useRef<HTMLDivElement>(null)
  // La partie peinte de la barre : sa hauteur est celle qui compte pour ce qui se colle dessous.
  const visible = useRef<HTMLDivElement>(null)
  const haut = useSousLaBarreDOutils(visible)
  const collee = useCollee(repere, haut)
  // Dépliée par l'utilisateur pendant qu'elle est collée ; revenue à sa place, elle se réduira de nouveau la prochaine fois.
  const [depliee, setDepliee] = useState(false)
  if (!collee && depliee) setDepliee(false)
  const reduite = collee && !depliee
  useHauteurReservee(barre, reduite)
  // Affichage « Trois vues » : les onglets des vues, collés sous la barre avec elle.
  const vues = useVuesDeLaPage()

  return (
    <>
      <div ref={repere} aria-hidden />
      <div ref={barre} data-barre-collante data-reduite={reduite || undefined} style={{ top: haut }} className={cn("sticky z-40 -mx-4 mb-6 sm:mx-0 print:hidden", reduite && "pointer-events-none")}>
        <div ref={visible} data-barre-visible className="pointer-events-auto">
          <section aria-label="Résumé de l'année" className={cn("border-y border-blue-200 bg-blue-50/95 px-4 py-1.5 text-sm backdrop-blur-sm sm:rounded-md sm:border dark:border-blue-900 dark:bg-slate-900/95", reduite && "max-sm:py-0", vues && "sm:rounded-b-none")}>
            <ChiffresClesDeLAnnee report={report} annees={annees} annee={annee} onAnnee={onAnnee} comparaison={comparaison} reduite={reduite} detail={collee ? <BoutonDuDetail deplie={depliee} alertes={nombreDAlertes(report)} onBasculer={() => setDepliee(!depliee)} /> : null} />
          </section>
          {vues ? <OngletsDesVues {...vues} /> : null}
        </div>
      </div>
    </>
  )
}

/**
 * Les réponses du comparateur, quand elles existent : l'effet d'un mariage ou d'un Pacs, la rémunération optimale
 * d'une société. Chacune mène à sa section ; sur un téléphone, seulement dans la barre dépliée.
 */
function ReponsesDuComparateur({ comparaison, className }: { comparaison: ResumeDeLaComparaison | null; className?: string }) {
  const gain = gainDuMariageOuDuPacs(comparaison?.result ?? null)
  const remuneration = remunerationOptimale(comparaison?.optimisation)
  return (
    <>
      {gain === null ? null : <Chiffre vers={ANCRE_DU_COUPLE} libelle="Mariage ou Pacs" valeur={ecartSigne(gain)} className={className} />}
      {remuneration === null ? null : <Chiffre vers={ANCRE_DE_LA_REMUNERATION} libelle="Rémunération optimale" valeur={euros(remuneration)} className={className} />}
    </>
  )
}

/** La ligne des chiffres clés ; réduite, sur un téléphone, le taux, les réponses et les alertes attendent le bouton qui la déplie. */
function ChiffresClesDeLAnnee({ report, annees, annee, onAnnee, comparaison, reduite, detail }: BarreDeResumeProps & { reduite: boolean; detail: ReactNode }) {
  const meilleur = meilleurStatut(comparaison?.result ?? null)
  const alertes = nombreDAlertes(report)
  const masqueSiReduite = reduite ? "max-sm:hidden" : undefined
  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-0.5", reduite && "max-sm:flex-nowrap max-sm:gap-x-3")}>
      <ChoixDeLAnnee annees={annees} annee={annee} onAnnee={onAnnee} />
      {report ? (
        <>
          <Chiffre vers="bilan" libelle="Net du foyer" libelleCourt="Net" valeur={euros(report.totalNetApresImpots)} className="shrink-0" />
          <Chiffre vers="bilan" libelle="Prélèvements" libelleCourt="Taux" valeur={tauxDePrelevement(report) ?? "—"} className={masqueSiReduite} />
        </>
      ) : null}
      {meilleur && comparaison?.activite ? <Chiffre vers="comparateur-verdict" libelle={`Meilleur statut pour « ${comparaison.activite} »`} libelleCourt="Meilleur" valeur={meilleur} icone={reduite ? <Trophy /> : undefined} /> : null}
      <ReponsesDuComparateur comparaison={comparaison} className={masqueSiReduite} />
      <Chiffre vers="resultats-titre" libelle="Alertes" valeur={alertes} className={cn(alertes > 0 && "text-amber-900 dark:text-amber-200", masqueSiReduite)} />
      {detail}
    </div>
  )
}
