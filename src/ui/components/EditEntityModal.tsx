// src/ui/components/EditEntityModal.tsx

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect, useMemo } from "react"
import type { Entity, Relationship, Person, Company, Avatar } from "@/types"
import { Trash2, PlusCircle, ArrowRight } from "lucide-react"
import { getAvailableRelationships } from "@/lib/graph-logic"
import { AvatarDisplay } from "./AvatarDisplay"
import { availableIconsSmall } from "@/lib/avatar-constants"
import { updatePersonAvatar } from "@/lib/avatar-utils"

interface EditEntityModalProps {
  entity: Entity | null
  isOpen: boolean
  onClose: () => void
  onSave: (updatedEntity: Entity, updatedRelationships: Relationship[]) => void
  allEntities: Entity[]
  relationships: Relationship[]
}

interface LocalState {
  entity: Entity | null
  relationships: Relationship[]
}

const availableColors = ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#8b5cf6", "#f97316"]

function EditEntityModal({ entity, isOpen, onClose, onSave, allEntities, relationships }: EditEntityModalProps) {
  const [formData, setFormData] = useState<LocalState>({ entity: null, relationships: [] })

  const [addingRelation, setAddingRelation] = useState(false)
  const [targetId, setTargetId] = useState<string | undefined>()
  const [relationshipType, setRelationshipType] = useState<Relationship["type"] | undefined>()

  useEffect(() => {
    if (isOpen && entity) {
      setFormData({
        entity: JSON.parse(JSON.stringify(entity)),
        relationships: JSON.parse(JSON.stringify(relationships))
      })
    }
    setAddingRelation(false)
    setTargetId(undefined)
    setRelationshipType(undefined)
  }, [entity, relationships, isOpen])

  const localEntity = formData.entity
  const localRelationships = formData.relationships

  const availableTargets = useMemo(() => allEntities.filter(e => e.id !== localEntity?.id), [allEntities, localEntity])
  const targetEntity = useMemo(() => allEntities.find(e => e.id === targetId), [allEntities, targetId])
  const availableTypes = useMemo(() => {
    if (!localEntity || !targetEntity) return []
    return getAvailableRelationships(localEntity, targetEntity, localRelationships)
  }, [localEntity, targetEntity, localRelationships])

  // NOTE: Les fonctions de mise à jour de l'état local sont maintenant spécifiques

  const handleAvatarChange = (newAvatarProps: Partial<Avatar>) => {
    if (localEntity) {
      setFormData(prev => ({
        ...prev,
        entity: { ...prev.entity!, avatar: { ...prev.entity!.avatar, ...newAvatarProps } }
      }))
    }
  }

  const handleAddRelationship = () => {
    if (!localEntity || !targetId || !relationshipType) return
    const newRelationship: Relationship = { id: `rel-${Date.now()}`, fromId: localEntity.id, toId: targetId, type: relationshipType }
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nom
              </Label>
              <Input id="name" name="name" value={localEntity.name || ""} onChange={e => setFormData(prev => ({ ...prev, entity: { ...prev.entity!, name: e.target.value } }))} className="col-span-3" />
            </div>
            {localEntity.type === "person" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fiscalParts" className="text-right">
                  Parts
                </Label>
                <Input
                  id="fiscalParts"
                  name="fiscalParts"
                  type="number"
                  step="0.5"
                  value={(localEntity as Person).fiscalParts || 1}
                  onChange={e =>
                    setFormData(prev => {
                      if (prev.entity?.type !== "person") return prev
                      return { ...prev, entity: { ...prev.entity, fiscalParts: parseFloat(e.target.value) || 0 } }
                    })
                  }
                  className="col-span-3"
                />
              </div>
            )}
            {localEntity.type === "company" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="legalStatus" className="text-right">
                  Statut
                </Label>
                <Select
                  value={(localEntity as Company).legalStatus}
                  onValueChange={(value: "SASU" | "EURL") =>
                    setFormData(prev => {
                      if (prev.entity?.type !== "company") return prev
                      return { ...prev, entity: { ...prev.entity, legalStatus: value } }
                    })
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Choisir un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SASU">SASU</SelectItem>
                    <SelectItem value="EURL">EURL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Couleur</Label>
              <div className="col-span-3 flex gap-2">
                {availableColors.map(color => (
                  <button type="button" key={color} onClick={() => handleAvatarChange({ color })} className={`h-8 w-8 rounded-full border-2 transition-all ${localEntity.avatar.color === color ? "border-primary ring-2 ring-ring" : "border-transparent"}`} style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
            {localEntity.type !== "person" && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Icône</Label>
                <div className="col-span-3 flex gap-2">
                  {Object.entries(availableIconsSmall).map(([key, icon]) => (
                    <button type="button" key={key} onClick={() => handleAvatarChange({ value: key, type: "icon" })} className={`flex h-10 w-10 items-center justify-center rounded-md border-2 transition-all ${localEntity.avatar.value === key ? "border-primary ring-2 ring-ring bg-secondary" : "border-transparent hover:bg-secondary/80"}`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-4 pt-6 border-t">
              <Label className="font-semibold text-base">Relations</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {relevantRelationships.length === 0 && !addingRelation && <p className="text-sm text-slate-500 italic col-span-full">Aucune relation.</p>}
                {relevantRelationships.map(rel => {
                  const isSource = rel.fromId === localEntity.id
                  const otherEntity = allEntities.find(e => e.id === (isSource ? rel.toId : rel.fromId))
                  if (!otherEntity) return null
                  return (
                    <div key={rel.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50 dark:bg-gray-800 border">
                      <div className="flex items-center gap-2">
                        {!isSource && <ArrowRight className="h-4 w-4 text-slate-400 transform rotate-180" />}
                        <AvatarDisplay avatar={otherEntity.avatar} size="sm" />
                        <div>
                          <div className="font-semibold">{otherEntity.name}</div>
                          <div className="text-blue-600 dark:text-blue-400 font-medium">{rel.type}</div>
                        </div>
                        {isSource && <ArrowRight className="h-4 w-4 text-slate-400" />}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteRelationship(rel.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
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
                    <SelectTrigger>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Type de relation..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTypes.map(t => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
