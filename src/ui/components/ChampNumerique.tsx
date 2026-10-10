// src/ui/components/ChampNumerique.tsx
// Champ numérique avec ses propres boutons − et + à la place des flèches du navigateur : même rendu dans Chromium
// et Firefox (qui ne laisse pas styler ses flèches), en thème clair comme sombre, avec de l'air entre le nombre et
// les boutons, et des cibles de 24 px au lieu de flèches minuscules.

import type { ComponentProps } from "react"
import { Minus, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { pasDuChamp, valeurApresUnPas } from "@/lib/champ-numerique"

type ChampNumeriqueProps = Omit<ComponentProps<"input">, "type"> & {
  /** Pas des boutons − et +, quand l'attribut `step` n'en donne pas (« any ») ; 1 par défaut. */
  pas?: number
  /** Ce que désignent les boutons, pour leur nom accessible : « Diminuer <quoi> de 50 ». Le nom du champ par défaut. */
  quoi?: string
  /** Classes du champ lui-même (hauteur, fond, alignement) ; `className` va au conteneur, qui porte la largeur. */
  classNameChamp?: string
}

/** Valeur du champ changée comme si on l'avait tapée : React reçoit son `onChange` habituel. */
function saisir(champ: HTMLInputElement, valeur: number) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(champ, String(valeur))
  champ.dispatchEvent(new Event("input", { bubbles: true }))
}

/**
 * Les boutons ne prennent pas le focus : au clavier, les flèches haut et bas du champ font la même chose, sans deux
 * arrêts de tabulation de plus par champ. Sur un écran tactile, ils s'effacent comme les flèches du navigateur :
 * le clavier numérique suffit.
 */
export function ChampNumerique({ className, classNameChamp, pas = 1, quoi, step, min, max, ...props }: ChampNumeriqueProps) {
  const pasEffectif = pasDuChamp(step, pas)
  const nom = quoi ?? (props["aria-label"] as string | undefined) ?? "la valeur"
  const pousser = (sens: 1 | -1, bouton: HTMLButtonElement) => {
    const champ = bouton.closest("[data-champ-nombre]")?.querySelector("input")
    if (!champ || champ.disabled || champ.readOnly) return
    saisir(champ, valeurApresUnPas(Number.parseFloat(champ.value), pasEffectif, sens, min === undefined ? undefined : Number(min), max === undefined ? undefined : Number(max)))
  }
  const bouton = "flex size-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 pointer-coarse:hidden print:hidden"
  return (
    <div data-champ-nombre className={cn("relative", className)}>
      <Input
        type="number"
        step={step}
        min={min}
        max={max}
        className={cn("w-full pr-16 pointer-coarse:pr-3 print:pr-3 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", props.disabled && "pr-3", classNameChamp)}
        {...props}
      />
      <div className="absolute inset-y-0 right-1.5 flex items-center gap-1">
        <button type="button" tabIndex={-1} aria-label={`Diminuer ${nom} de ${pasEffectif.toLocaleString("fr-FR")}`} className={bouton} disabled={props.disabled} onClick={e => pousser(-1, e.currentTarget)}>
          <Minus aria-hidden className="size-3.5" />
        </button>
        <button type="button" tabIndex={-1} aria-label={`Augmenter ${nom} de ${pasEffectif.toLocaleString("fr-FR")}`} className={bouton} disabled={props.disabled} onClick={e => pousser(1, e.currentTarget)}>
          <Plus aria-hidden className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
