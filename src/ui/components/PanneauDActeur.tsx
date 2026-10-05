// src/ui/components/PanneauDActeur.tsx
// Affichage « Panneaux » (proposition C de l'étude d'allègement de l'écran) : le panneau d'un acteur, non modal, à
// droite sur ordinateur, en bas de l'écran sur téléphone. Il réunit la carte de l'acteur, les réglages de la fenêtre
// « Modifier » et sa carte de résultats ; chaque modification s'applique aussitôt, et le résumé la suit.

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { ArrowDown, ChevronsDownUp, ChevronsUpDown, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Entity, SessionState, SimulationReport } from "@/types"
import { typeCourt } from "@/lib/reglages-des-acteurs"
import { cn } from "@/lib/utils"
import { useActionsSurLesActeurs } from "../hooks/useActionsSurLesActeurs"
import { ID_DU_PANNEAU } from "../hooks/useInspecteur"
import { useReglagesSurPlace } from "../hooks/useReglagesSurPlace"
import { AvatarDisplay } from "./AvatarDisplay"
import { ChampsDeLActeur } from "./ChampsDeLActeur"
import { Depliable } from "./Depliable"
import { BoutonVerrouiller, OptionsDeLaMicro, PastilleDeRelation } from "./ElementsDActeur"
import { NewRelationshipForm } from "./NewRelationshipForm"
import { CarteDeLActeur } from "./ResultsPanel"

interface PanneauDActeurProps {
  /** Acteur affiché ; il existe dans la session. */
  acteurId: string
  session: SessionState
  setSession: (session: SessionState) => void
  report: SimulationReport | null
  onFermer: () => void
  /** Choisit l'activité dans le comparateur et y mène. */
  onComparer: (activiteId: string) => void
}

const TITRE = "panneau-acteur-titre"
const SOUS_TITRE = "text-sm font-semibold text-slate-800 dark:text-slate-100"

/**
 * Sur téléphone, le panneau couvre le bas de la page : sa hauteur est réservée sous la page, pour en atteindre la fin,
 * et dans le défilement vers un élément qui reçoit le focus, pour qu'il ne passe pas dessous (WCAG 2.4.11).
 */
function useHauteurReservee(panneau: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = panneau.current
    if (!element) return
    const racine = document.documentElement
    const mesurer = () => {
      const enBas = getComputedStyle(element).position === "fixed"
      const hauteur = enBas ? element.offsetHeight : 0
      document.body.style.paddingBottom = enBas ? `${hauteur}px` : ""
      racine.style.scrollPaddingBottom = enBas ? `${hauteur + 8}px` : ""
    }
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(element)
    window.addEventListener("resize", mesurer)
    return () => {
      observateur.disconnect()
      window.removeEventListener("resize", mesurer)
      document.body.style.paddingBottom = ""
      racine.style.scrollPaddingBottom = ""
    }
  }, [panneau])
}

export function PanneauDActeur(props: PanneauDActeurProps) {
  const entity = props.session.entities.find(e => e.id === props.acteurId)
  // Un brouillon de saisie ne passe pas d'un acteur à l'autre.
  return entity ? <PanneauOuvert key={entity.id} {...props} entity={entity} /> : null
}

function PanneauOuvert({ entity, session, setSession, report, onFermer, onComparer }: PanneauDActeurProps & { entity: Entity }) {
  const panneau = useRef<HTMLElement>(null)
  const titre = useRef<HTMLHeadingElement>(null)
  const [agrandi, setAgrandi] = useState(false)
  const actions = useActionsSurLesActeurs(session, setSession)
  const reglages = useReglagesSurPlace(entity, actions.updateEntity)
  useHauteurReservee(panneau)

  // À l'ouverture, et donc à chaque changement d'acteur, le focus passe au titre du panneau.
  useEffect(() => {
    titre.current?.focus()
  }, [])

  const relations = session.relationships.filter(r => r.fromId === entity.id || r.toId === entity.id)

  // Échap ferme le panneau, sauf s'il sert à une liste ouverte (rendue hors du panneau) ou à annuler une saisie.
  const surTouche = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && !event.defaultPrevented && event.currentTarget.contains(event.target as Node)) onFermer()
  }

  return (
    <aside
      ref={panneau}
      id={ID_DU_PANNEAU}
      aria-labelledby={TITRE}
      onKeyDown={surTouche}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-xl border-t bg-white shadow-[0_-4px_16px_rgb(0_0_0/0.15)] motion-safe:animate-in motion-safe:slide-in-from-bottom-8 motion-safe:fade-in-0 dark:bg-gray-950 print:hidden",
        agrandi ? "max-h-[calc(100dvh-var(--haut-collant,4rem))]" : "max-h-[50dvh]",
        "lg:sticky lg:inset-x-auto lg:top-[var(--haut-collant,8rem)] lg:z-30 lg:max-h-[calc(100dvh-var(--haut-collant,8rem)-1rem)] lg:w-96 lg:shrink-0 lg:self-start lg:rounded-lg lg:border lg:shadow-md lg:motion-safe:slide-in-from-right-8"
      )}
    >
      <div className="flex items-start gap-3 border-b px-4 py-3">
        <AvatarDisplay avatar={entity.avatar} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 id={TITRE} ref={titre} tabIndex={-1} className="text-lg leading-tight font-semibold [overflow-wrap:anywhere] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {entity.name}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{typeCourt(entity)}</p>
        </div>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-expanded={agrandi} aria-label={agrandi ? "Réduire le panneau" : "Agrandir le panneau"} onClick={() => setAgrandi(!agrandi)}>
          {agrandi ? <ChevronsDownUp className="h-4 w-4" /> : <ChevronsUpDown className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Fermer le panneau" title="Fermer (Échap)" onClick={onFermer}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 overflow-y-auto overscroll-contain px-4 py-3">
        {entity.type === "micro-entreprise" ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <OptionsDeLaMicro entity={entity} onUpdate={actions.updateEntity} compactes />
          </div>
        ) : null}

        {entity.type === "person" ? null : (
          <Button variant="outline" size="sm" onClick={() => onComparer(entity.id)}>
            Comparer ses statuts
            <ArrowDown aria-hidden="true" />
          </Button>
        )}

        <section aria-labelledby="panneau-acteur-resultats" className="space-y-2">
          <h3 id="panneau-acteur-resultats" className={SOUS_TITRE}>
            Résultats {report?.annee ?? ""}
          </h3>
          <CarteDeLActeur report={report} entityId={entity.id} />
        </section>

        <section aria-labelledby="panneau-acteur-relations" className="space-y-2">
          <h3 id="panneau-acteur-relations" className={SOUS_TITRE}>
            Relations
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {relations.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-400">Aucune relation.</p> : null}
            {relations.map(relation => (
              <PastilleDeRelation key={relation.id} relation={relation} entity={entity} allEntities={session.entities} onDelete={actions.deleteRelationship} compacte />
            ))}
            <NewRelationshipForm entity={entity} allEntities={session.entities} relationships={session.relationships} onAdd={actions.addRelationship} />
          </div>
        </section>

        <Depliable titre="Autres réglages (nom, parts, statut, couleur, frais…)" id={`autres-reglages:${entity.id}`} className="text-sm">
          <div className="grid gap-5 pt-3" {...reglages.conteneur}>
            <ChampsDeLActeur entity={reglages.entity} onChange={reglages.onChange} />
          </div>
        </Depliable>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <BoutonVerrouiller entity={entity} onToggleLock={actions.toggleLock} />
          <Button variant="outline" size="sm" disabled={entity.locked} className="ml-auto text-rose-700 hover:text-rose-800 dark:text-rose-400" onClick={() => actions.deleteEntity(entity.id)}>
            <Trash2 aria-hidden="true" />
            Supprimer « {entity.name} »
          </Button>
        </div>
      </div>
    </aside>
  )
}
