// src/ui/components/Bulle.tsx
// Les bulles ouvertes d'un clic sur un petit bouton : une note du comparateur, le détail d'une alerte, une précision
// du tableau. Au clic plutôt qu'au survol, pour qu'elles s'ouvrent aussi au doigt.
//
// La bulle est posée dans la page (portail vers le body), pas dans l'élément qui porte son bouton : elle n'agrandit
// pas un tableau qui défile de côté et n'y ajoute pas de barre de défilement ; elle défile avec la page, ce qui permet
// de lire une bulle plus longue que l'écran.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { CircleHelp } from "lucide-react"
import { placerLaBulle, type CoteDeLaBulle } from "@/lib/bulle"
import { cn } from "@/lib/utils"

/** Teinte des bulles des alertes et des notes, comme les alertes elles-mêmes. */
export const BULLE_AMBRE = "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50"
/** Teinte neutre, pour les précisions qui ne sont pas des alertes. */
export const BULLE_NEUTRE = "border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"

interface BullePoseeProps {
  id: string
  /** L'élément qui a ouvert la bulle : elle se pose à côté de lui, et un clic dessus ne compte pas comme un clic ailleurs. */
  ancre: HTMLElement
  onFermer: () => void
  /** Teinte de la bulle (BULLE_AMBRE, BULLE_NEUTRE). */
  teinte: string
  /** Ce qui, en changeant, peut changer la taille de la bulle : elle est replacée, du côté choisi selon la place. */
  contenuCle?: unknown
  /** Reçoit le texte de la bulle une fois posée, pour l'annoncer. */
  onTexte?: (texte: string) => void
  children: ReactNode
}

/**
 * La bulle, posée dans la page près de son ancre (voir src/lib/bulle.ts) : elle défile avec la page, comme l'ancre, et
 * se replace quand un tableau défile de côté. Elle se ferme d'un clic ailleurs, à Échap (le focus revient à l'ancre)
 * et quand la fenêtre change de taille. Faire défiler n'est pas cliquer : cela ne la ferme pas.
 */
/**
 * Bas des barres collées en haut de l'écran : la barre d'outils (fixe) et la barre de résumé quand elle est collée
 * dessous ; plus bas dans la page, cette dernière défile avec le contenu et ne cache rien.
 */
function basDesBarres(): number {
  const outils = document.querySelector("nav[aria-label=\"Barre d'outils\"]")?.getBoundingClientRect().bottom ?? 0
  const resume = document.querySelector("[data-barre-collante]")?.getBoundingClientRect()
  return resume && resume.top <= outils + 1 ? Math.max(outils, resume.bottom) : outils
}

export function BullePosee({ id, ancre, onFermer, teinte, contenuCle, onTexte, children }: BullePoseeProps) {
  const bulle = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  // Le côté retenu à l'ouverture (dessous, ou dessus faute de place) : la bulle replacée ne change pas de côté.
  const cote = useRef<CoteDeLaBulle | undefined>(undefined)

  // Place la bulle dans la page : sa place à l'écran, plus le défilement de la page, en pixels de la page zoomée.
  const placer = useCallback(() => {
    if (!bulle.current) return
    const zoom = Number.parseFloat(getComputedStyle(document.body).zoom) || 1
    const cadre = bulle.current.getBoundingClientRect()
    const place = placerLaBulle(ancre.getBoundingClientRect(), { largeur: cadre.width, hauteur: cadre.height }, { largeur: document.documentElement.clientWidth, hauteur: window.innerHeight, haut: basDesBarres() }, zoom, cote.current)
    cote.current = place.cote
    // Sans arrondir le défilement : deux arrondis de suite décaleraient la bulle de 2 px à l'écran sous un zoom de 200 %.
    const dansLaPage = { left: place.left + window.scrollX / zoom, top: place.top + window.scrollY / zoom }
    setPosition(actuelle => (actuelle?.left === dansLaPage.left && actuelle.top === dansLaPage.top ? actuelle : dansLaPage))
  }, [ancre])

  useLayoutEffect(() => {
    cote.current = undefined
    placer()
    onTexte?.(bulle.current?.textContent ?? "")
  }, [placer, contenuCle, onTexte])

  useEffect(() => {
    const clicAilleurs = (evenement: PointerEvent) => {
      const cible = evenement.target
      // Un clic sur l'ancre elle-même la referme par son propre bouton.
      if (cible instanceof Node && !bulle.current?.contains(cible) && !ancre.contains(cible)) onFermer()
    }
    const touche = (evenement: KeyboardEvent) => {
      if (evenement.key !== "Escape") return
      onFermer()
      ancre.focus()
    }
    // La page qui défile emporte la bulle avec l'ancre : rien à faire. Un tableau qui défile de côté (téléphone)
    // déplace l'ancre seule : la bulle la rejoint.
    const defilement = (evenement: Event) => {
      if (evenement.target !== document) placer()
    }
    document.addEventListener("pointerdown", clicAilleurs)
    document.addEventListener("keydown", touche)
    window.addEventListener("resize", onFermer)
    // En capture : le défilement d'un tableau plus large que l'écran ne remonte pas jusqu'à la fenêtre.
    window.addEventListener("scroll", defilement, true)
    return () => {
      document.removeEventListener("pointerdown", clicAilleurs)
      document.removeEventListener("keydown", touche)
      window.removeEventListener("resize", onFermer)
      window.removeEventListener("scroll", defilement, true)
    }
  }, [ancre, onFermer, placer])

  // Hors de l'élément de l'ancre : dans un en-tête de tableau, son texte s'ajouterait au nom de la colonne, relu à
  // chaque cellule. Au-dessus de la colonne fixe du tableau, sous la barre de résumé et la barre d'outils.
  return createPortal(
    <div
      ref={bulle}
      id={id}
      role="tooltip"
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
      className={cn("absolute z-30 w-80 max-w-[calc(100vw/var(--zoom,1)_-_1rem)] rounded-md border p-3 text-left text-sm font-normal shadow-lg print:hidden", teinte)}
    >
      {children}
    </div>,
    document.body
  )
}

interface AideEnBulleProps {
  /** Nom du bouton, pour un lecteur d'écran (« Détail de l'alerte »). */
  libelle: string
  /** Ce que dit la bulle, en texte, quand elle n'a pas d'autre contenu. */
  texte?: string
  teinte?: string
  className?: string
  /** Le contenu de la bulle, à la place du texte. */
  children?: ReactNode
}

/**
 * Un bouton (?) qui ouvre une bulle ; un second clic, un clic ailleurs ou Échap la ferme. Une seule bulle ouverte à la
 * fois : le clic sur un autre bouton ferme la première. Absent à l'impression, qui affiche le texte à sa place.
 * Le texte de la bulle ouverte est annoncé à un lecteur d'écran.
 */
export function AideEnBulle({ libelle, texte, teinte = BULLE_AMBRE, className, children }: AideEnBulleProps) {
  const [ancre, setAncre] = useState<HTMLElement | null>(null)
  const [annonce, setAnnonce] = useState("")
  const id = `${useId()}-bulle`
  const fermer = useCallback(() => {
    setAncre(null)
    setAnnonce("")
  }, [])
  return (
    <>
      <button
        type="button"
        aria-label={libelle}
        aria-expanded={ancre !== null}
        aria-describedby={ancre ? id : undefined}
        className={cn(
          "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full align-middle text-current opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current pointer-coarse:-my-2.5 pointer-coarse:size-11 print:hidden",
          ancre && "opacity-100 ring-2 ring-current",
          className
        )}
        onClick={evenement => {
          const bouton = evenement.currentTarget
          if (ancre) fermer()
          else setAncre(bouton)
        }}
      >
        <CircleHelp aria-hidden="true" className="size-4" />
      </button>
      {/* Zone d'annonce : un lecteur d'écran y entend le contenu de la bulle quand elle s'ouvre. */}
      <span role="status" className="sr-only">
        {annonce}
      </span>
      {ancre ? (
        <BullePosee id={id} ancre={ancre} onFermer={fermer} teinte={teinte} contenuCle={texte ?? children} onTexte={setAnnonce}>
          {children ?? <p>{texte}</p>}
        </BullePosee>
      ) : null}
    </>
  )
}
