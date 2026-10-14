// src/ui/components/EntitiesManager.tsx

import { ajoutDUneActivite, createPerson, type Exercant } from "@/lib/entity-factory"
import { appliquerLeChangement, type NatureDesPrestations, type StatutDUneActivite } from "@/lib/changement-de-statut"
import { estEntrepriseOuMicro, type Entity, type Person, type Relationship, type SessionState } from "@/types"
import { Button } from "@/components/ui/button"
import { useState, useMemo } from "react"
import EditEntityModal from "./EditEntityModal"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { EntityItem } from "./EntityItem"
import { SelectEntityTypeModal } from "./SelectEntityTypeModal"
import { ConfirmationDuChangementDeStatut, type DemandeDeChangement } from "./ConfirmationDuChangementDeStatut"
import { useTriAccessible } from "../hooks/useTriAccessible"
import { useAffichageResume } from "../hooks/useAffichage"
import { useActionsSurLesActeurs } from "../hooks/useActionsSurLesActeurs"
import { LigneActeur } from "./LigneActeur"
import { cn } from "@/lib/utils"
import type { MontageType } from "@/lib/montages/montages"
import { BoutonDesMontages } from "./MontagesTypes"
import { ID_DE_L_AJOUT_D_UNE_PERSONNE } from "@/lib/questions-de-depart"

interface EntitiesManagerProps {
  session: SessionState
  setSession: (session: SessionState) => void
  /** L'année affichée : la fenêtre « Modifier » décrit la profession avec ses règles. */
  annee: number
  /** Une simulation vide propose de partir d'un montage type : rien n'est perdu, aucune confirmation n'est demandée. */
  onChargerMontage?: (montage: MontageType) => void
}

/** Mise en page de la liste selon l'affichage : classique, ou « Résumé » (une ligne par acteur). */
const MISE_EN_PAGE = {
  classique: { cadre: "p-6", titre: "mb-4", boutons: "mb-6 gap-4", taille: "default" },
  resume: { cadre: "p-4", titre: "mb-3", boutons: "mb-3 gap-2", taille: "sm" }
} as const

function EntitiesManager({ session, setSession, annee, onChargerMontage }: EntitiesManagerProps) {
  const { entities, relationships } = session
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)
  const [isSelectModalOpen, setSelectModalOpen] = useState(false)
  const entityIds = useMemo(() => entities.map(e => e.id), [entities])
  const personnes = useMemo(() => entities.filter((e): e is Person => e.type === "person"), [entities])
  // Affichage « Résumé » : un acteur par ligne, des commandes d'ajout plus discrètes.
  const resume = useAffichageResume()
  const Acteur = resume ? LigneActeur : EntityItem
  const tri = useTriAccessible(useMemo(() => entities.map(e => ({ id: e.id, nom: e.name })), [entities]))
  const { applyChange, addEntity, deleteEntity, updateEntity, toggleLock, addRelationship, deleteRelationship } = useActionsSurLesActeurs(session, setSession)

  // L'activité, la personne créée avec elle s'il y a lieu et leur relation : une seule modification, annulable en une étape.
  const ajouterUneActivite = (statut: StatutDUneActivite, exercant: Exercant) => applyChange(ajoutDUneActivite(session, statut, exercant))

  // Changement de statut demandé par la fiche : confirmé à part, puis appliqué à la session telle que la fiche la
  // modifie, en une seule étape d'historique ; la fiche reste ouverte sur l'activité convertie.
  const [changement, setChangement] = useState<DemandeDeChangement | null>(null)
  const demanderLeChangement = (brouillon: Entity, relationsDuBrouillon: Relationship[], cible: StatutDUneActivite) => {
    if (!estEntrepriseOuMicro(brouillon)) return
    setChangement({ session: { ...session, entities: entities.map(e => (e.id === brouillon.id ? brouillon : e)), relationships: relationsDuBrouillon }, activite: brouillon, cible })
  }
  const convertir = (nature: NatureDesPrestations) => {
    if (!changement) return
    const { session: convertie, activite } = appliquerLeChangement(changement.session, changement.activite, changement.cible, nature)
    applyChange({ entities: convertie.entities, relationships: convertie.relationships, annees: convertie.annees })
    setChangement(null)
    setEditingEntity(activite)
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

  const style = resume ? MISE_EN_PAGE.resume : MISE_EN_PAGE.classique

  return (
    <div className={cn("bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md", style.cadre)}>
      <h2 className={cn("text-2xl font-semibold", style.titre)}>
        Personnes et activités
      </h2>
      <div className={cn("flex flex-wrap print:hidden", style.boutons)}>
        <Button id={ID_DE_L_AJOUT_D_UNE_PERSONNE} size={style.taille} onClick={() => addEntity(createPerson())}>
          + Ajouter une personne
        </Button>
        <Button size={style.taille} onClick={() => setSelectModalOpen(true)} variant="secondary">
          + Ajouter une activité
        </Button>
      </div>
      <DndContext {...tri} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={entityIds} strategy={verticalListSortingStrategy}>
          <div className={resume ? "space-y-2" : "space-y-4"}>
            {entities.length === 0 ? listeVide : entities.map(entity => <Acteur key={entity.id} entity={entity} allEntities={entities} relationships={relationships} annee={annee} onUpdate={updateEntity} onDelete={deleteEntity} onToggleLock={toggleLock} onEdit={setEditingEntity} onAddRelationship={addRelationship} onDeleteRelationship={deleteRelationship} />)}
          </div>
        </SortableContext>
      </DndContext>

      <EditEntityModal isOpen={!!editingEntity} entity={editingEntity} onClose={() => setEditingEntity(null)} onSave={handleSaveFromModal} allEntities={entities} relationships={relationships} anneesSimulees={session.annees.map(a => a.annee)} annee={annee} onChangerDeStatut={demanderLeChangement} />
      <ConfirmationDuChangementDeStatut demande={changement} annee={annee} onAnnuler={() => setChangement(null)} onConfirmer={convertir} />

      <SelectEntityTypeModal isOpen={isSelectModalOpen} onClose={() => setSelectModalOpen(false)} personnes={personnes} onSelect={ajouterUneActivite} />
    </div>
  )
}

export default EntitiesManager
