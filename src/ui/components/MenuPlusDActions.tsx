// src/ui/components/MenuPlusDActions.tsx
// « Plus d'actions » : sur un téléphone, les actions secondaires de la barre d'outils (montages types, avis,
// affichage, thème) dans un menu, pour que la barre tienne dans l'écran sans rien couper. Sur un écran plus large,
// elles restent dans la barre et ce bouton n'est pas affiché.
//
// Le projet n'a pas le menu de Radix (aucune dépendance ajoutée pour lui) : c'est le motif « bouton de menu » des
// WAI-ARIA Authoring Practices, écrit ici. Flèches haut et bas (en boucle), Début et Fin pour parcourir ; Entrée ou
// Espace pour choisir ; Échap ferme et rend le focus au bouton ; Tab ferme et passe à la suite ; un clic hors du
// menu le ferme.

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { Check, EllipsisVertical, LayoutTemplate, MessageSquareHeart, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AFFICHAGES } from "@/lib/affichage"
import { cn } from "@/lib/utils"
import type { Affichage } from "@/types"
import { useTheme } from "../hooks/useTheme"

interface MenuPlusDActionsProps {
  affichage: Affichage
  onAffichage: (affichage: Affichage) => void
  /** Ouvre la fenêtre d'avis ; le focus reviendra sur le bouton du menu, donné en paramètre. */
  onAvis: (declencheur: HTMLElement) => void
  /** Ouvre la fenêtre des montages types, de même. */
  onMontages: (declencheur: HTMLElement) => void
  className?: string
}

/** Une entrée du menu : une action, un choix parmi d'autres (affichage) ou une case (thème sombre). */
interface Entree {
  cle: string
  libelle: string
  role: "menuitem" | "menuitemradio" | "menuitemcheckbox"
  coche?: boolean
  icone?: ReactNode
  /** Ce que change un affichage, en info-bulle. */
  description?: string
  /** Reçoit le bouton du menu, où le focus reviendra après une fenêtre ouverte par l'entrée. */
  choisir: (declencheur: HTMLElement) => void
}

/** Position de l'entrée qui reçoit le focus après une touche, ou null si la touche ne déplace pas le focus. */
function entreeApresLaTouche(touche: string, actuelle: number, nombre: number): number | null {
  const deplacements: Record<string, number> = {
    ArrowDown: (actuelle + 1) % nombre,
    ArrowUp: (actuelle - 1 + nombre) % nombre,
    Home: 0,
    End: nombre - 1
  }
  return touche in deplacements ? deplacements[touche] : null
}

/** Les entrées du menu, dans l'ordre du parcours au clavier. */
const entreesDuMenu = (menu: HTMLElement | null) => Array.from(menu?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])

const ENTREE = "flex w-full min-h-9 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none select-none hover:bg-accent focus:bg-accent focus:text-accent-foreground pointer-coarse:min-h-11 [&_svg]:size-4 [&_svg]:shrink-0"

function LigneDuMenu({ entree, onChoisir }: { entree: Entree; onChoisir: (entree: Entree) => void }) {
  const avecCoche = entree.role !== "menuitem"
  // Un choix ou une case : la coche quand l'entrée est retenue ; une action : son icône.
  const icone = avecCoche ? entree.coche && <Check /> : entree.icone
  return (
    <button type="button" role={entree.role} aria-checked={avecCoche ? Boolean(entree.coche) : undefined} tabIndex={-1} title={entree.description} className={ENTREE} onClick={() => onChoisir(entree)}>
      <span aria-hidden className="flex size-4 items-center justify-center text-slate-600 dark:text-slate-400">
        {icone}
      </span>
      <span>{entree.libelle}</span>
    </button>
  )
}

export function MenuPlusDActions({ affichage, onAffichage, onAvis, onMontages, className }: MenuPlusDActionsProps) {
  const [ouvert, setOuvert] = useState(false)
  // Entrée à focaliser à l'ouverture : la première (clic, Entrée, flèche bas) ou la dernière (flèche haut).
  const [premiere, setPremiere] = useState<"debut" | "fin">("debut")
  const [theme, setTheme] = useTheme()
  const id = useId()
  const bouton = useRef<HTMLButtonElement>(null)
  const conteneur = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  const fermer = (rendreLeFocus: boolean) => {
    setOuvert(false)
    if (rendreLeFocus) bouton.current?.focus()
  }
  const ouvrir = (depuis: "debut" | "fin") => {
    setPremiere(depuis)
    setOuvert(true)
  }

  // À l'ouverture, le focus va dans le menu.
  useEffect(() => {
    if (!ouvert) return
    const entrees = entreesDuMenu(menu.current)
    entrees[premiere === "fin" ? entrees.length - 1 : 0]?.focus()
  }, [ouvert, premiere])

  // Un clic ou un toucher hors du menu et de son bouton le ferme, sans déplacer le focus.
  useEffect(() => {
    if (!ouvert) return
    const horsDuMenu = (evenement: PointerEvent) => {
      if (evenement.target instanceof Node && !conteneur.current?.contains(evenement.target)) setOuvert(false)
    }
    document.addEventListener("pointerdown", horsDuMenu)
    return () => document.removeEventListener("pointerdown", horsDuMenu)
  }, [ouvert])

  const actions: Entree[] = [
    { cle: "montages", libelle: "Montages types", role: "menuitem", icone: <LayoutTemplate />, choisir: onMontages },
    { cle: "avis", libelle: "Donner mon avis", role: "menuitem", icone: <MessageSquareHeart />, choisir: onAvis }
  ]
  const affichages: Entree[] = AFFICHAGES.map(a => ({ cle: a.valeur, libelle: a.libelle, role: "menuitemradio", coche: a.valeur === affichage, description: a.description, choisir: () => onAffichage(a.valeur) }))
  const sombre: Entree = { cle: "theme", libelle: "Thème sombre", role: "menuitemcheckbox", coche: theme === "dark", icone: <Moon />, choisir: () => setTheme(theme === "dark" ? "light" : "dark") }

  // Le menu se ferme et rend le focus à son bouton, puis l'entrée agit (une fenêtre ouverte y ramènera le focus).
  const choisir = (entree: Entree) => {
    fermer(true)
    if (bouton.current) entree.choisir(bouton.current)
  }

  const toucheDuMenu = (evenement: KeyboardEvent<HTMLDivElement>) => {
    if (evenement.key === "Escape") {
      evenement.preventDefault()
      evenement.stopPropagation()
      fermer(true)
      return
    }
    // Tab : le focus revient au bouton, d'où la tabulation du navigateur passe à l'élément suivant ou précédent.
    if (evenement.key === "Tab") return fermer(true)
    const entrees = entreesDuMenu(evenement.currentTarget)
    const suivante = entreeApresLaTouche(evenement.key, entrees.indexOf(document.activeElement as HTMLElement), entrees.length)
    if (suivante === null) return
    evenement.preventDefault()
    entrees[suivante].focus()
  }

  const toucheDuBouton = (evenement: KeyboardEvent<HTMLButtonElement>) => {
    if (evenement.key !== "ArrowDown" && evenement.key !== "ArrowUp") return
    evenement.preventDefault()
    ouvrir(evenement.key === "ArrowUp" ? "fin" : "debut")
  }

  const ligne = (entree: Entree) => <LigneDuMenu key={entree.cle} entree={entree} onChoisir={choisir} />

  return (
    <div ref={conteneur} className={cn("relative", className)}>
      <Button ref={bouton} variant="ghost" size="icon" aria-label="Plus d'actions" aria-haspopup="menu" aria-expanded={ouvert} aria-controls={ouvert ? `${id}-menu` : undefined} className="h-10 w-9 pointer-coarse:h-11 pointer-coarse:w-11 [&_svg]:size-6" onClick={() => (ouvert ? fermer(false) : ouvrir("debut"))} onKeyDown={toucheDuBouton}>
        <EllipsisVertical className="text-slate-600 dark:text-slate-400" />
      </Button>
      {ouvert ? (
        <div ref={menu} id={`${id}-menu`} role="menu" tabIndex={-1} aria-label="Plus d'actions" onKeyDown={toucheDuMenu} className="absolute top-full right-0 z-50 mt-1 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95">
          {actions.map(ligne)}
          <div role="separator" className="-mx-1 my-1 h-px bg-border" />
          <div role="group" aria-labelledby={`${id}-affichage`}>
            <p id={`${id}-affichage`} className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400">
              Affichage (bêta)
            </p>
            {affichages.map(ligne)}
          </div>
          <div role="separator" className="-mx-1 my-1 h-px bg-border" />
          {ligne(sombre)}
        </div>
      ) : null}
    </div>
  )
}
