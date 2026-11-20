// src/ui/components/ReperesDeDefilement.tsx
// Ce qui dit qu'un tableau défile en largeur : une ombre du côté où des colonnes sont cachées, et une flèche qui y mène.
//
// L'ombre vient de `--ombre-de-defilement` (App.css), une teinte par thème.
//
// Les flèches sont attachées au tableau, à mi-hauteur : elles défilent avec lui, on ne les voit pas bouger. Elles ne
// s'en détachent que pour rester à l'écran, loin de ses bords :
// - un tableau qui tient à l'écran garde ses flèches à mi-hauteur, sans exception ;
// - un tableau plus haut que l'écran les retient à 30 % du haut ou du bas de ce qui se voit (sous les barres collées
//   en haut) : elles attendent là que le milieu du tableau arrive, le suivent, puis attendent de l'autre côté ;
// - elles ne s'approchent jamais du haut ni du bas du tableau (4 rem, ou le quart de sa hauteur s'il est petit) : quand
//   il sort de l'écran, elles sortent avec lui.
// Le tout sans calcul au défilement : chaque flèche est collante (`position: sticky`) dans un calque plus court que le
// tableau, et le navigateur la place lui-même, sans saut. La retenue est bornée par la moitié de la hauteur du
// tableau : c'est ce qui laisse en place les flèches d'un tableau entièrement visible.
//
// Elles sont à cheval sur le bord du tableau, pour n'en cacher presque rien, et discrètes au repos : pleinement
// visibles quand le pointeur est sur le tableau.
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

/** Part de la hauteur visible, sous les barres, que les flèches d'un tableau plus haut que l'écran gardent libre au-dessus et au-dessous d'elles. */
const PART_LIBRE = 0.3

/**
 * Distance à laquelle une flèche de 2 rem est retenue du haut et du bas de ce qui se voit : la part libre de la hauteur
 * visible, sans dépasser la moitié de la place autour d'elle dans le tableau (voir l'en-tête du fichier).
 */
const RETENUE = `max(0px, min((100dvh / var(--zoom, 1) - var(--haut-des-barres, 0px)) * ${PART_LIBRE}, (100cqh - 2rem) / 2))`
const PLACE_DE_LA_FLECHE: CSSProperties = { top: `calc(var(--haut-des-barres, 0px) + ${RETENUE})`, bottom: RETENUE }

interface FlechesDeDefilementProps extends Pick<OmbresDesBordsProps, "gauche" | "droite"> {
  /** Hauteur des barres collées en haut de la fenêtre, en pixels : les flèches restent à l'écran dessous. */
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
        "pointer-events-auto sticky flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-800 opacity-60 shadow-sm transition-opacity group-hover/zone:opacity-100 hover:bg-slate-100 hover:opacity-100 motion-reduce:transition-none dark:border-slate-600 dark:bg-gray-900 dark:text-slate-100 dark:hover:bg-gray-800",
        !visible && "invisible"
      )}
    >
      <Icone aria-hidden className="size-5" />
    </button>
  )
}

/** Flèches de défilement, attachées au tableau (voir l'en-tête du fichier). Absentes sur écran tactile et à l'impression. */
export function FlechesDeDefilement({ gauche, droite, hautDesBarres, onDefiler }: FlechesDeDefilementProps) {
  return (
    // Le calque extérieur donne la hauteur du tableau (`100cqh`) ; le calque intérieur, plus court, tient les flèches
    // loin du haut et du bas. 18 px dehors à gauche : la flèche ne touche pas le texte de la première colonne ; 16 px
    // à droite : la marge de la page.
    <div data-fleches-de-defilement style={{ "--haut-des-barres": `${hautDesBarres}px` } as CSSProperties} className="pointer-events-none absolute inset-y-0 -right-4 -left-[1.125rem] z-10 [container-type:size] pointer-coarse:hidden print:hidden">
      <div className="absolute inset-x-0 inset-y-[min(4rem,25cqh)] flex items-center justify-between">
        <Fleche sens={-1} visible={gauche} onDefiler={onDefiler} />
        <Fleche sens={1} visible={droite} onDefiler={onDefiler} />
      </div>
    </div>
  )
}
