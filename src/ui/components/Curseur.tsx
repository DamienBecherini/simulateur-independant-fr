// src/ui/components/Curseur.tsx
// Curseurs du comparateur, faits maison pour régler un montant au pas de 100 € : la barre du partage du bénéfice
// (deux poignées) et le curseur de la rémunération saisie (une poignée) partagent leur poignée, ici, ainsi que leur
// réglage au clavier et leur glissement au pointeur (src/ui/curseur.ts).

import { useState, type KeyboardEvent } from "react"
import { auPas, PAS_REMUNERATION } from "@/lib/repartition-benefice"
import { cn } from "@/lib/utils"
import { clavierDuCurseur, gestesDuCurseur, montantAuPointeur, type Glissement } from "../curseur"
import { euros } from "@/backend/logic/format"


interface PoigneeProps {
  nom: string
  /** Place de la poignée sur la piste, de 0 à 1. */
  position: number
  libelle: string
  valeur: number
  min?: number
  max: number
  texte: string
  /** Identifiant du texte qui décrit le curseur (ses bornes, par exemple). */
  decritPar?: string
  onClavier: (e: KeyboardEvent<HTMLDivElement>) => void
  /** Classes du trait de la poignée, plus court sur une piste fine. */
  classNameTrait?: string
}

/** Poignée d'un curseur : un élément role="slider" qu'on fait glisser ou qu'on règle au clavier. */
export function PoigneeDeCurseur({ nom, position, libelle, valeur, min = 0, max, texte, decritPar, onClavier, classNameTrait = "h-10" }: PoigneeProps) {
  return (
    <div
      role="slider"
      tabIndex={0}
      data-poignee={nom}
      aria-label={libelle}
      aria-orientation="horizontal"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={valeur}
      aria-valuetext={texte}
      aria-describedby={decritPar}
      onKeyDown={onClavier}
      style={{ left: `${Math.min(1, Math.max(0, position)) * 100}%` }}
      className="absolute top-1/2 z-10 flex h-11 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-md active:cursor-grabbing pointer-coarse:w-11 print:hidden"
    >
      <span aria-hidden="true" className={cn("w-2 rounded-full bg-slate-900 ring-2 ring-white dark:bg-slate-50 dark:ring-gray-950", classNameTrait)} />
    </div>
  )
}

interface CurseurDeRemunerationProps {
  /** Rémunération saisie ; au-delà du plafond, la poignée reste en bout de piste. */
  valeur: number
  /** Plus haute rémunération possible sans déficit : la fin de la piste. */
  max: number
  libelle: string
  decritPar?: string
  /** Pendant le glissement, la valeur montrée (pour que le champ voisin la suive), puis `null` au relâchement. */
  onApercu: (valeur: number | null) => void
  onValider: (valeur: number) => void
}

/**
 * Curseur d'une rémunération, de 0 à `max`, au pas de 100 € : les mêmes poignée, clavier et gestes que la barre du
 * partage du bénéfice, sur une piste simple.
 */
export function CurseurDeRemuneration({ valeur, max, libelle, decritPar, onApercu, onValider }: CurseurDeRemunerationProps) {
  const [glissement, setGlissement] = useState<Glissement<"remuneration"> | null>(null)
  const montre = Math.min(max, glissement?.valeur ?? valeur)
  const glisser = (nouveau: Glissement<"remuneration"> | null) => {
    setGlissement(nouveau)
    onApercu(nouveau?.valeur ?? null)
  }
  const gestes = gestesDuCurseur<"remuneration">({
    actif: max > 0,
    glissement,
    onGlisser: glisser,
    onValider: ({ valeur: validee }) => onValider(validee),
    poigneeVisee: () => "remuneration",
    valeurAuPointeur: (_, e) => auPas(montantAuPointeur(e.currentTarget, e.clientX, max), PAS_REMUNERATION, 0, max)
  })
  const position = max > 0 ? montre / max : 0
  const auDela = glissement === null && valeur > max
  return (
    <div className="relative h-11 cursor-pointer touch-none" {...gestes}>
      <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-300 dark:bg-slate-600" />
      <div aria-hidden="true" className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-700 dark:bg-slate-300" style={{ width: `${position * 100}%` }} />
      <PoigneeDeCurseur
        nom="remuneration"
        position={position}
        libelle={libelle}
        valeur={montre}
        max={max}
        texte={auDela ? `${euros(valeur)} de rémunération nette, au-delà des ${euros(max)} possibles sans déficit` : `${euros(montre)} de rémunération nette`}
        decritPar={decritPar}
        onClavier={clavierDuCurseur(montre, { min: 0, max, pas: PAS_REMUNERATION, grandPas: 1000 }, onValider)}
        classNameTrait="h-6"
      />
    </div>
  )
}
