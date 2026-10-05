// src/ui/components/EntitiesManager.tsx

import { createPerson, createCompany, createMicroEntreprise } from "@/lib/entity-factory"
import type { Entity, Relationship, Company, MicroEntreprise, SessionState } from "@/types"
import { Button } from "@/components/ui/button"
import { useState, useMemo, type ReactNode } from "react"
import EditEntityModal from "./EditEntityModal"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, rectSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { EntityItem } from "./EntityItem"
import { SelectEntityTypeModal, BusinessEntityType } from "./SelectEntityTypeModal"
import { useTriAccessible } from "../hooks/useTriAccessible"
import { useAffichagePanneaux, useAffichageResume } from "../hooks/useAffichage"
import { useActionsSurLesActeurs } from "../hooks/useActionsSurLesActeurs"
import { ID_DU_TITRE_DES_ACTEURS } from "../hooks/useInspecteur"
import { lignesDesReglages } from "@/lib/reglages-des-acteurs"
import { LigneActeur } from "./LigneActeur"
import { PuceActeur } from "./PuceActeur"
import { cn } from "@/lib/utils"
import type { MontageType } from "@/lib/montages/montages"
import { BoutonDesMontages } from "./MontagesTypes"

interface EntitiesManagerProps {
  session: SessionState
  setSession: (session: SessionState) => void
  /** Une simulation vide propose de partir d'un montage type : rien n'est perdu, aucune confirmation n'est demandée. */
  onChargerMontage?: (montage: MontageType) => void
}

/**
 * Affichage « Panneaux », sur papier : le panneau d'un acteur ne s'imprime pas, alors les réglages de chaque acteur
 * s'impriment ici, en clair.
 */
function ReglagesImprimes({ entities, relationships }: { entities: Entity[]; relationships: Relationship[] }) {
  return (
    <ul className="hidden space-y-2 print:block">
      {entities.map(entity => (
        <li key={entity.id} data-impression="bloc" className="rounded-lg border p-3 text-sm">
          <p className="font-semibold">{entity.name}</p>
          <p className="text-slate-600">{lignesDesReglages(entity, entities, relationships).join(" · ")}</p>
        </li>
      ))}
    </ul>
  )
}

/** Mise en page de la liste selon l'affichage : classique, « Résumé » (une ligne par acteur), « Panneaux » (liste courte). */
const MISE_EN_PAGE = {
  classique: { cadre: "p-6", entete: undefined, titre: "mb-4", boutons: "mb-6 gap-4", taille: "default" },
  resume: { cadre: "p-4", entete: undefined, titre: "mb-3", boutons: "mb-3 gap-2", taille: "sm" },
  panneaux: { cadre: "p-4", entete: "mb-3 flex flex-wrap items-center gap-x-4 gap-y-2", titre: undefined, boutons: "gap-2", taille: "sm" }
} as const

/** Affichage « Panneaux » : avatar, nom et type de chaque acteur ; à l'impression, ses réglages en clair. */
function ListeCourte({ entities, relationships, listeVide }: { entities: Entity[]; relationships: Relationship[]; listeVide: ReactNode }) {
  if (entities.length === 0) return listeVide
  return (
    <>
      <ul aria-labelledby={ID_DU_TITRE_DES_ACTEURS} className="flex flex-wrap gap-2 print:hidden">
        {entities.map(entity => (
          <PuceActeur key={entity.id} entity={entity} />
        ))}
      </ul>
      <ReglagesImprimes entities={entities} relationships={relationships} />
    </>
  )
}

function EntitiesManager({ session, setSession, onChargerMontage }: EntitiesManagerProps) {
  const { entities, relationships } = session
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)
  const [isSelectModalOpen, setSelectModalOpen] = useState(false)
  const entityIds = useMemo(() => entities.map(e => e.id), [entities])
  // Affichage « Résumé » : un acteur par ligne, des commandes d'ajout plus discrètes. Affichage « Panneaux » : une
  // liste courte, les réglages de chacun dans son panneau.
  const resume = useAffichageResume()
  const panneaux = useAffichagePanneaux()
  const Acteur = resume ? LigneActeur : EntityItem
  const tri = useTriAccessible(useMemo(() => entities.map(e => ({ id: e.id, nom: e.name })), [entities]))
  const { applyChange, addEntity, deleteEntity, updateEntity, toggleLock, addRelationship, deleteRelationship } = useActionsSurLesActeurs(session, setSession)

  const handleAddBusiness = (type: BusinessEntityType) => {
    let newEntity: Company | MicroEntreprise
    switch (type) {
      case "MicroEntreprise":
        newEntity = createMicroEntreprise()
        break
      case "EI":
      case "SASU":
      case "EURL":
        newEntity = createCompany(type)
        break
    }
    addEntity(newEntity)
  }

  const handleSaveFromModal = (updatedEntity: Entity, updatedRelationships: Relationship[]) => {
    applyChange({
      entities: entities.map(entity => (entity.id === updatedEntity.id ? updatedEntity : entity)),
      relationships: updatedRelationships
    })
    setEditingEntity(null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = entities.findIndex(item => item.id === active.id)
      const newIndex = entities.findIndex(item => item.id === over.id)
      applyChange({ entities: arrayMove(entities, oldIndex, newIndex) })
    }
  }

  const listeVide = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-slate-600 dark:text-slate-400">Aucune entité. Commencez par en ajouter une !</p>
      {onChargerMontage ? <BoutonDesMontages variant="outline" size="sm" className="print:hidden" onCharger={onChargerMontage} confirmationNecessaire={false} nomDeLaSession={session.name} /> : null}
    </div>
  )

  const style = panneaux ? MISE_EN_PAGE.panneaux : resume ? MISE_EN_PAGE.resume : MISE_EN_PAGE.classique

  return (
    <div className={cn("bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md", style.cadre)}>
      <div className={style.entete}>
        <h2 id={ID_DU_TITRE_DES_ACTEURS} tabIndex={panneaux ? -1 : undefined} className={cn("text-2xl font-semibold", style.titre)}>
          Acteurs de la Simulation
        </h2>
        <div className={cn("flex flex-wrap print:hidden", style.boutons)}>
          <Button size={style.taille} onClick={() => addEntity(createPerson())}>
            + Ajouter une Personne
          </Button>
          <Button size={style.taille} onClick={() => setSelectModalOpen(true)} variant="secondary">
            + Ajouter une Activité
          </Button>
        </div>
      </div>
      <DndContext {...tri} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={entityIds} strategy={panneaux ? rectSortingStrategy : verticalListSortingStrategy}>
          {panneaux ? (
            <ListeCourte entities={entities} relationships={relationships} listeVide={listeVide} />
          ) : (
            <div className={resume ? "space-y-2" : "space-y-4"}>
              {entities.length === 0 ? listeVide : entities.map(entity => <Acteur key={entity.id} entity={entity} allEntities={entities} relationships={relationships} onUpdate={updateEntity} onDelete={deleteEntity} onToggleLock={toggleLock} onEdit={setEditingEntity} onAddRelationship={addRelationship} onDeleteRelationship={deleteRelationship} />)}
            </div>
          )}
        </SortableContext>
      </DndContext>

      <EditEntityModal isOpen={!!editingEntity} entity={editingEntity} onClose={() => setEditingEntity(null)} onSave={handleSaveFromModal} allEntities={entities} relationships={relationships} />

      <SelectEntityTypeModal isOpen={isSelectModalOpen} onClose={() => setSelectModalOpen(false)} onSelect={handleAddBusiness} />
    </div>
  )
}

export default EntitiesManager
