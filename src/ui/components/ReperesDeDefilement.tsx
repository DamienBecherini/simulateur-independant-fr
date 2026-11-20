// src/ui/components/ReperesDeDefilement.tsx
// Ce qui dit qu'un tableau défile en largeur : une ombre du côté où des colonnes sont cachées, et une flèche qui y mène.
//
// L'ombre prend la couleur du texte (`--ombre-de-defilement`, App.css) : sombre sur un fond clair, claire sur un fond
// sombre, où une ombre noire ne se verrait pas.
//
// Les flèches restent au milieu de ce qui se voit du tableau, sans calcul au défilement de la page : chacune est
// collante (`position: sticky`) dans un calque qui recouvre le tableau, à mi-hauteur de celui-ci, et retenue à
// distance égale du haut et du bas de la fenêtre. Cette distance vaut la moitié de la plus petite des deux hauteurs,
// celle du tableau et celle de la fenêtre sous les barres collées en haut :
// - un tableau qui tient à l'écran garde ses flèches à mi-hauteur ;
// - un tableau plus haut que l'écran les garde au milieu de l'écran, tant qu'il le traverse ;
// - quand le tableau sort de l'écran, elles le quittent avec son bord, sans jamais en dépasser.
// Le navigateur les place lui-même pendant le défilement : elles ne sautent pas. Chacune est à cheval sur le bord du
// tableau, pour n'en cacher presque rien.
//
// Écran tactile : pas de flèches (on fait glisser le tableau du doigt, et une cible de 44 px en cacherait trop) ; les
// ombres restent. Au clavier, la zone elle-même prend le focus et défile avec les flèches du clavier : les boutons
// sont donc hors de l'ordre de tabulation.

import type { CSSProperties } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface OmbresDesBordsProps {
  /** Des colonnes sont cachées à gauche (après la première colonne, si elle est fixe). */
  gauche: boolean
  /** Des colonnes sont cachées à droite. */
  droite: boolean
  /** Largeur de la première colonne quand elle reste fixe : l'ombre de gauche commence après elle. */
  colonneFixe: number
}

/** Ombres aux bords de la zone qui défile. Purement décoratives. */
export function OmbresDesBords({ gauche, droite, colonneFixe }: OmbresDesBordsProps) {
  const ombre = "pointer-events-none absolute inset-y-0 z-10 w-6 from-(--ombre-de-defilement) to-transparent transition-opacity motion-reduce:transition-none print:hidden forced-colors:hidden"
  return (
    <>
      <div aria-hidden data-ombre="gauche" style={{ left: colonneFixe }} className={cn(ombre, "bg-linear-to-r", colonneFixe === 0 && "rounded-l-[inherit]", gauche ? "opacity-100" : "opacity-0")} />
      <div aria-hidden data-ombre="droite" className={cn(ombre, "right-0 rounded-r-[inherit] bg-linear-to-l", droite ? "opacity-100" : "opacity-0")} />
    </>
  )
}

/** Moitié de la hauteur libre autour d'une flèche de 2 rem : voir l'en-tête du fichier. */
const RETENUE = "max(0px, (min(100dvh / var(--zoom, 1) - var(--haut-des-barres, 0px), 100cqh) - 2rem) / 2)"
const PLACE_DE_LA_FLECHE: CSSProperties = { top: `calc(var(--haut-des-barres, 0px) + ${RETENUE})`, bottom: RETENUE }

interface FlechesDeDefilementProps extends Pick<OmbresDesBordsProps, "gauche" | "droite"> {
  /** Hauteur des barres collées en haut de la fenêtre, en pixels : les flèches se centrent sur ce qui se voit dessous. */
  hautDesBarres: number
  onDefiler: (sens: -1 | 1) => void
}

function Fleche({ sens, visible, onDefiler }: { sens: -1 | 1; visible: boolean; onDefiler: (sens: -1 | 1) => void }) {
  const Icone = sens < 0 ? ChevronLeft : ChevronRight
  const libelle = sens < 0 ? "Voir les colonnes de gauche" : "Voir les colonnes de droite"
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={libelle}
      title={libelle}
      style={PLACE_DE_LA_FLECHE}
      // Le clic ne prend pas le focus : il reste où il était, et ne se perd pas quand la flèche disparaît au bout.
      onMouseDown={e => e.preventDefault()}
      onClick={() => onDefiler(sens)}
      className={cn(
        "pointer-events-auto sticky flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 shadow-md hover:bg-slate-100 dark:border-slate-500 dark:bg-gray-900 dark:text-slate-100 dark:shadow-[0_2px_10px_var(--ombre-de-defilement)] dark:hover:bg-gray-800",
        !visible && "invisible"
      )}
    >
      <Icone aria-hidden className="size-5" />
    </button>
  )
}

/** Flèches de défilement, au milieu de ce qui se voit du tableau. Absentes sur écran tactile et à l'impression. */
export function FlechesDeDefilement({ gauche, droite, hautDesBarres, onDefiler }: FlechesDeDefilementProps) {
  return (
    <div data-fleches-de-defilement style={{ "--haut-des-barres": `${hautDesBarres}px` } as CSSProperties} className="pointer-events-none absolute inset-y-0 -right-4 -left-[1.125rem] z-10 flex items-center justify-between [container-type:size] pointer-coarse:hidden print:hidden">
      <Fleche sens={-1} visible={gauche} onDefiler={onDefiler} />
      <Fleche sens={1} visible={droite} onDefiler={onDefiler} />
    </div>
  )
}
