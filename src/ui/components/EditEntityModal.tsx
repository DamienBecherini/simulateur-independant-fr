// src/ui/components/EditEntityModal.tsx

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useMemo } from "react"
import type { Entity, Relationship } from "@/types"
import { Trash2, PlusCircle, ArrowRight } from "lucide-react"
import { AIDE_RELATION_SALARIE, getAvailableRelationships, getRelationshipLabel } from "@/lib/graph-logic"
import { AvatarDisplay } from "./AvatarDisplay"
import { ChampsDeLActeur } from "./ChampsDeLActeur"
import { updatePersonAvatar } from "@/lib/avatar-utils"
import { createId } from "@/lib/id"

interface EditEntityModalProps {
  entity: Entity | null
  isOpen: boolean
  onClose: () => void
  onSave: (updatedEntity: Entity, updatedRelationships: Relationship[]) => void
  allEntities: Entity[]
  relationships: Relationship[]
  /** Années de la simulation, pour les champs qui en dépendent (RFR N-2 d'une micro-entreprise). */
  anneesSimulees?: number[]
  /** L'année affichée : les champs qui décrivent des règles (profession) prennent les siennes. */
  annee: number
}

interface LocalState {
  entity: Entity | null
  relationships: Relationship[]
}

/** Ce dont le formulaire est parti, pour le réinitialiser quand cela change. */
interface SourceDuFormulaire {
  entity: Entity | null
  relationships: Relationship[]
  isOpen: boolean
}

const memeSource = (a: SourceDuFormulaire | null, b: SourceDuFormulaire) => a !== null && a.entity === b.entity && a.relationships === b.relationships && a.isOpen === b.isOpen

function EditEntityModal({ entity, isOpen, onClose, onSave, allEntities, relationships, anneesSimulees, annee }: EditEntityModalProps) {
  const [formData, setFormData] = useState<LocalState>({ entity: null, relationships: [] })

  const [addingRelation, setAddingRelation] = useState(false)
  const [targetId, setTargetId] = useState<string | undefined>()
  const [relationshipType, setRelationshipType] = useState<Relationship["type"] | undefined>()

  // À l'ouverture et à chaque changement de l'acteur ou des relations reçus, le formulaire repart d'eux ; mise à jour
  // pendant le rendu plutôt que dans un effet.
  const [source, setSource] = useState<SourceDuFormulaire | null>(null)
  if (!memeSource(source, { entity, relationships, isOpen })) {
    setSource({ entity, relationships, isOpen })
    if (isOpen && entity) {
      // Copies de travail : rien ne change dans la session avant « Enregistrer ».
      setFormData({ entity: structuredClone(entity), relationships: structuredClone(relationships) })
    }
    setAddingRelation(false)
    setTargetId(undefined)
    setRelationshipType(undefined)
  }

  const localEntity = formData.entity
  const localRelationships = formData.relationships

  const availableTargets = useMemo(() => allEntities.filter(e => e.id !== localEntity?.id), [allEntities, localEntity])
  const targetEntity = useMemo(() => allEntities.find(e => e.id === targetId), [allEntities, targetId])
  const availableTypes = useMemo(() => {
    if (!localEntity || !targetEntity) return []
    return getAvailableRelationships(localEntity, targetEntity, localRelationships)
  }, [localEntity, targetEntity, localRelationships])

  const handleAddRelationship = () => {
    if (!localEntity || !targetId || !relationshipType) return
    const newRelationship: Relationship = { id: createId("rel"), fromId: localEntity.id, toId: targetId, type: relationshipType }
    setFormData(prev => ({ ...prev, relationships: [...prev.relationships, newRelationship] }))
    setAddingRelation(false)
    setTargetId(undefined)
    setRelationshipType(undefined)
  }

  const handleDeleteRelationship = (relId: string) => {
    setFormData(prev => ({ ...prev, relationships: prev.relationships.filter(rel => rel.id !== relId) }))
  }

  const handleSaveAndClose = () => {
    if (localEntity) {
      let finalEntity = localEntity
      if (finalEntity.type === "person") {
        const updatedAvatar = updatePersonAvatar(finalEntity.avatar, finalEntity.name)
        finalEntity = { ...finalEntity, avatar: updatedAvatar }
      }
      onSave(finalEntity, localRelationships)
      onClose()
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSaveAndClose()
  }

  if (!localEntity) return null

  const relevantRelationships = localRelationships.filter(r => r.fromId === localEntity.id || r.toId === localEntity.id)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleFormSubmit}>
          <DialogHeader>
            <DialogTitle>Modifier : {localEntity.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
            <ChampsDeLActeur entity={localEntity} anneesSimulees={anneesSimulees} annee={annee} onChange={entity => setFormData(prev => ({ ...prev, entity }))} />
            <div className="space-y-4 pt-6 border-t">
              <h3 className="font-semibold text-base">Relations</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {relevantRelationships.length === 0 && !addingRelation && <p className="text-sm text-slate-600 dark:text-slate-400 italic col-span-full">Aucune relation.</p>}
                {relevantRelationships.map(rel => {
                  const isSource = rel.fromId === localEntity.id
                  const otherEntity = allEntities.find(e => e.id === (isSource ? rel.toId : rel.fromId))
                  if (!otherEntity) return null
                  return (
                    <div key={rel.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50 dark:bg-gray-800 border">
                      <div className="flex items-center gap-2">
                        {!isSource && <ArrowRight className="h-4 w-4 text-slate-500 dark:text-slate-400 transform rotate-180" />}
                        <AvatarDisplay avatar={otherEntity.avatar} size="sm" />
                        <div>
                          <div className="font-semibold">{otherEntity.name}</div>
                          <div className="text-blue-600 dark:text-blue-400 font-medium">{getRelationshipLabel(rel.type, isSource)}</div>
                        </div>
                        {isSource && <ArrowRight className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 pointer-coarse:h-11 pointer-coarse:w-11" aria-label={`Supprimer la relation avec ${otherEntity.name}`} onClick={() => handleDeleteRelationship(rel.id)}>
                        <Trash2 className="h-4 w-4 text-destructive dark:text-red-400" />
                      </Button>
                    </div>
                  )
                })}
              </div>
              {!addingRelation ? (
                <Button type="button" variant="outline" className="w-full" onClick={() => setAddingRelation(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Ajouter une relation
                </Button>
              ) : (
                <div className="p-3 border rounded-lg space-y-3 bg-slate-50 dark:bg-gray-800">
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger aria-label="Lier avec">
                      <SelectValue placeholder="Lier avec..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTargets.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={relationshipType} onValueChange={(value: Relationship["type"]) => setRelationshipType(value)} disabled={!targetId || availableTypes.length === 0}>
                    <SelectTrigger aria-label="Type de relation">
                      <SelectValue placeholder="Type de relation..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map(t => (
                        <SelectItem key={t} value={t}>
                          {getRelationshipLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {availableTypes.includes("Salarié") ? <p className="text-sm text-slate-600 dark:text-slate-400">{AIDE_RELATION_SALARIE}</p> : null}
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" onClick={() => setAddingRelation(false)}>
                      Annuler
                    </Button>
                    <Button type="button" onClick={handleAddRelationship} disabled={!targetId || !relationshipType}>
                      Confirmer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="pt-6 border-t">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Annuler
              </Button>
            </DialogClose>
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditEntityModal
