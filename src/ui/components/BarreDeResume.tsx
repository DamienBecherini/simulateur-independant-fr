// src/ui/components/BarreDeResume.tsx
// Affichage « Résumé » (proposition A de l'étude d'allègement de l'écran) : les chiffres clés de l'année, toujours
// visibles sous la barre d'outils et recalculés à chaque modification. Chacun mène à son détail.

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { meilleurStatut, nombreDAlertes, tauxDePrelevement, type ResumeDeLaComparaison } from "@/lib/resume"
import { euros } from "@/backend/logic/format"
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
    }
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    if (outils) observateur.observe(outils)
    if (barre.current) observateur.observe(barre.current)
    return () => {
      observateur.disconnect()
      racine.style.scrollPaddingTop = ""
    }
  }, [barre])
  return haut
}

/** Un chiffre clé : un lien vers son détail, au libellé complet pour les lecteurs d'écran. */
function Chiffre({ vers, libelle, libelleCourt, valeur, className }: { vers: string; libelle: string; libelleCourt?: string; valeur: ReactNode; className?: string }) {
  return (
    <a href={`#${vers}`} className={cn("inline-flex min-h-6 items-baseline gap-1.5 rounded-sm underline-offset-2 hover:underline pointer-coarse:min-h-11 pointer-coarse:items-center", className)}>
      <span className={cn("text-slate-600 dark:text-slate-300", libelleCourt && "max-sm:hidden")}>{libelle}</span>
      {libelleCourt ? <span className="text-slate-600 sm:hidden dark:text-slate-300">{libelleCourt}</span> : null}
      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{valeur}</span>
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

export function BarreDeResume({ report, annees, annee, onAnnee, comparaison }: BarreDeResumeProps) {
  const barre = useRef<HTMLDivElement>(null)
  const haut = useSousLaBarreDOutils(barre)
  const meilleur = meilleurStatut(comparaison?.result ?? null)
  const alertes = nombreDAlertes(report)
  // Affichage « Trois vues » : les onglets des vues, collés sous la barre avec elle.
  const vues = useVuesDeLaPage()

  return (
    <div ref={barre} data-barre-collante style={{ top: haut }} className="sticky z-40 -mx-4 mb-6 sm:mx-0 print:hidden">
      <section aria-label="Résumé de l'année" className={cn("border-y border-blue-200 bg-blue-50/95 px-4 py-1.5 text-sm backdrop-blur-sm sm:rounded-md sm:border dark:border-blue-900 dark:bg-slate-900/95", vues && "sm:rounded-b-none")}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-0.5">
          <ChoixDeLAnnee annees={annees} annee={annee} onAnnee={onAnnee} />
          {report ? (
            <>
              <Chiffre vers="bilan" libelle="Net du foyer" libelleCourt="Net" valeur={euros(report.totalNetApresImpots)} />
              <Chiffre vers="bilan" libelle="Prélèvements" libelleCourt="Taux" valeur={tauxDePrelevement(report) ?? "—"} />
            </>
          ) : null}
          {meilleur && comparaison ? <Chiffre vers="comparateur-verdict" libelle={`Meilleur statut pour « ${comparaison.activite} »`} libelleCourt="Meilleur" valeur={meilleur} /> : null}
          <Chiffre vers="resultats-titre" libelle="Alertes" valeur={alertes} className={alertes > 0 ? "text-amber-900 dark:text-amber-200" : undefined} />
        </div>
      </section>
      {vues ? <OngletsDesVues {...vues} /> : null}
    </div>
  )
}
