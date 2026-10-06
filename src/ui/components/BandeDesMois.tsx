// src/ui/components/BandeDesMois.tsx
// Bande des mois, au-dessus de la grille mensuelle quand celle-ci déborde de l'écran (sur téléphone, seuls un ou deux
// mois se voient à côté de la première colonne). Elle montre quels mois sont à l'écran, comme la fenêtre d'une
// mini-carte, signale d'un point les mois qui ont des flux, et mène à un mois d'un toucher.
//
// Tailles des cibles (WCAG 2.5.8) : à 320 px, douze mois ne peuvent pas avoir chacun 24 px de large. Les flèches
// « Mois précédent » et « Mois suivant », elles, mesurent 28 px (44 px au doigt) et mènent à chaque mois : c'est
// l'exception « équivalent » du critère. La bande garde 44 px de haut au doigt et se parcourt aussi en glissant
// le doigt (ou la souris) tout du long, comme un curseur : toute sa largeur sert alors de cible.

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { nomDuMoisDeLaBande } from "@/lib/bande-des-mois"
import { cn } from "@/lib/utils"

interface BandeDesMoisProps {
  /** Noms courts des mois (« Janv », « Févr »...), affichés à partir de 640 px ; en dessous, leur initiale. */
  libelles: string[]
  /** Noms complets des mois, pour les lecteurs d'écran. */
  noms: string[]
  /** Nombre de flux de chaque mois, tous acteurs confondus. */
  flux: number[]
  /** Mois visibles dans la grille, de gauche à droite. */
  visibles: number[]
  auDebut: boolean
  aLaFin: boolean
  /** Distance du haut de la fenêtre où la bande reste collée (sous les barres du haut). */
  haut: number
  onMois: (index: number) => void
  onVoisin: (sens: -1 | 1) => void
  /** Glisser le long de la bande : position de 0 (début de janvier) à 1 (fin de décembre). */
  onGlisser: (position: number) => void
}

/** Distance, en pixels, au-delà de laquelle un appui devient un glisser : en deçà, c'est un toucher. */
const SEUIL_DU_GLISSER = 6

/** Glisser le long de la bande. Un glisser n'est pas un toucher : le clic qui le termine est ignoré. */
function useGlisser(onGlisser: (position: number) => void) {
  const depart = useRef<{ x: number; glisse: boolean } | null>(null)
  const ignorerLeClic = useRef(false)

  const position = (e: PointerEvent<HTMLElement>) => {
    const zone = e.currentTarget.getBoundingClientRect()
    return zone.width > 0 ? (e.clientX - zone.left) / zone.width : 0
  }
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button === 0) depart.current = { x: e.clientX, glisse: false }
  }
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const appui = depart.current
    if (!appui || (!appui.glisse && Math.abs(e.clientX - appui.x) < SEUIL_DU_GLISSER)) return
    if (!appui.glisse) e.currentTarget.setPointerCapture(e.pointerId)
    appui.glisse = true
    onGlisser(position(e))
  }
  const finir = () => {
    if (depart.current?.glisse) {
      ignorerLeClic.current = true
      // Le clic suit aussitôt le relâchement ; s'il ne vient pas (relâché hors d'un mois), l'oubli est levé ensuite.
      setTimeout(() => (ignorerLeClic.current = false), 0)
    }
    depart.current = null
  }
  /** Vrai une fois, pour le clic qui suit un glisser. */
  const clicAIgnorer = () => {
    const ignorer = ignorerLeClic.current
    ignorerLeClic.current = false
    return ignorer
  }
  return { gestes: { onPointerDown, onPointerMove, onPointerUp: finir, onPointerCancel: finir }, clicAIgnorer }
}

/** Flèche d'un mois vers la gauche ou la droite. Inactive au bout, sans perdre le focus (`aria-disabled`). */
function Fleche({ sens, inactive, onVoisin }: { sens: -1 | 1; inactive: boolean; onVoisin: (sens: -1 | 1) => void }) {
  const Icone = sens < 0 ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      aria-label={sens < 0 ? "Mois précédent" : "Mois suivant"}
      aria-disabled={inactive || undefined}
      onClick={() => !inactive && onVoisin(sens)}
      className="flex w-7 shrink-0 items-center justify-center rounded-md text-slate-700 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent pointer-coarse:w-11 dark:text-slate-200 dark:hover:bg-gray-800"
    >
      <Icone aria-hidden className="size-5" />
    </button>
  )
}

export function BandeDesMois({ libelles, noms, flux, visibles, auDebut, aLaFin, haut, onMois, onVoisin, onGlisser }: BandeDesMoisProps) {
  const boutons = useRef<(HTMLButtonElement | null)[]>([])
  // Barre d'outils des WAI-ARIA : un seul mois dans l'ordre de tabulation, les flèches du clavier passent aux autres.
  const [focalise, setFocalise] = useState<number | null>(null)
  const arret = focalise ?? visibles[0] ?? 0
  const { gestes, clicAIgnorer } = useGlisser(onGlisser)

  const auClavier = (e: KeyboardEvent<HTMLDivElement>) => {
    const cibles: Record<string, number> = { ArrowLeft: arret - 1, ArrowRight: arret + 1, Home: 0, End: noms.length - 1 }
    const cible = cibles[e.key]
    if (cible === undefined) return
    e.preventDefault()
    boutons.current[Math.min(Math.max(cible, 0), noms.length - 1)]?.focus()
  }

  return (
    <div style={{ top: haut }} className="sticky z-20 mb-1 flex h-9 gap-1 bg-slate-50 py-0.5 pointer-coarse:h-12 dark:bg-gray-950 print:hidden">
      <Fleche sens={-1} inactive={auDebut} onVoisin={onVoisin} />
      <div
        role="toolbar"
        aria-label="Mois de la grille"
        onKeyDown={auClavier}
        onBlur={e => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocalise(null)}
        className="flex min-w-0 flex-1 touch-pan-y rounded-md bg-slate-200 select-none dark:bg-gray-800"
        {...gestes}
      >
        {noms.map((nom, index) => {
          const visible = visibles.includes(index)
          return (
            <button
              key={nom}
              ref={bouton => {
                boutons.current[index] = bouton
              }}
              type="button"
              tabIndex={index === arret ? 0 : -1}
              aria-label={nomDuMoisDeLaBande(nom, flux[index] ?? 0)}
              aria-current={visible || undefined}
              onFocus={() => setFocalise(index)}
              onClick={() => !clicAIgnorer() && onMois(index)}
              className={cn(
                "relative flex min-w-0 flex-1 items-center justify-center text-xs focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                visible ? "bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white" : "text-slate-700 hover:bg-slate-300/70 dark:text-slate-300 dark:hover:bg-gray-700",
                // Les mois visibles se suivent : ils forment une seule fenêtre, arrondie à ses deux bouts.
                (!visible || !visibles.includes(index - 1)) && "rounded-l-md",
                (!visible || !visibles.includes(index + 1)) && "rounded-r-md"
              )}
            >
              <span aria-hidden className="sm:hidden">
                {nom[0]}
              </span>
              <span aria-hidden className="max-sm:hidden">
                {libelles[index]}
              </span>
              {flux[index] > 0 ? <span aria-hidden data-point className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current pointer-coarse:bottom-1.5" /> : null}
            </button>
          )
        })}
      </div>
      <Fleche sens={1} inactive={aLaFin} onVoisin={onVoisin} />
    </div>
  )
}

/**
 * Fondus aux bords de la zone qui défile : à droite tant qu'il reste des mois à voir, à gauche (après la première
 * colonne, fixe) dès que la grille a défilé. Purement décoratifs.
 */
export function FondusDesBords({ gauche, droite, colonneFixe }: { gauche: boolean; droite: boolean; colonneFixe: number }) {
  const fondu = "pointer-events-none absolute inset-y-0 z-10 w-6 from-slate-50 to-transparent transition-opacity motion-reduce:transition-none dark:from-gray-950 print:hidden"
  return (
    <>
      <div aria-hidden data-fondu="gauche" style={{ left: colonneFixe }} className={cn(fondu, "bg-linear-to-r", gauche ? "opacity-100" : "opacity-0")} />
      <div aria-hidden data-fondu="droite" className={cn(fondu, "right-0 bg-linear-to-l", droite ? "opacity-100" : "opacity-0")} />
    </>
  )
}
