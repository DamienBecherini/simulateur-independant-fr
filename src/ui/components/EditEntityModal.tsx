// src/ui/components/EditEntityModal.tsx

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect, useMemo, Dispatch, SetStateAction } from "react"
import { Trash2, PlusCircle, ArrowRight } from "lucide-react"
import { getAvailableRelationships } from "@/lib/graph-logic"
import { AvatarDisplay, availableIconsSmall } from "./AvatarDisplay"
import { updatePersonAvatar } from "@/lib/avatar-utils"

interface EditEntityModalProps {
  entity: Entity | null
  isOpen: boolean
  onClose: () => void
  onSave: (updatedEntity: Entity) => void
  allEntities: Entity[]
  relationships: Relationship[]
  setRelationships: Dispatch<SetStateAction<Relationship[]>>
}

const availableColors = ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#8b5cf6", "#f97316"]

function EditEntityModal({ entity, isOpen, onClose, onSave, allEntities, relationships, setRelationships }: EditEntityModalProps) {
  const [formData, setFormData] = useState<Entity | null>(null)
  const [addingRelation, setAddingRelation] = useState(false)
  const [targetId, setTargetId] = useState<string | undefined>()
  const [relationshipType, setRelationshipType] = useState<string | undefined>()
  const [isDeleteAlertOpen, setDeleteAlertOpen] = useState(false)
  const [relationToDelete, setRelationToDelete] = useState<Relationship | null>(null)

  useEffect(() => {
    setFormData(entity)
    setAddingRelation(false)
    setTargetId(undefined)
    setRelationshipType(undefined)
  }, [entity, isOpen])

  const availableTargets = useMemo(() => allEntities.filter(e => e.id !== entity?.id), [allEntities, entity])
  const targetEntity = useMemo(() => allEntities.find(e => e.id === targetId), [allEntities, targetId])
  const availableTypes = useMemo(() => {
    // Si l'une des entités n'est pas définie, il n'y a pas de types disponibles.
    if (!entity || !targetEntity) return []
    // 2. APPELER le service centralisé pour obtenir la liste des relations valides
    return getAvailableRelationships(entity, targetEntity, relationships)
  }, [entity, targetEntity, relationships]) // On s'assure que relationships est bien dans les dépendances

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (formData) {
      setFormData({ ...formData, [name]: name === "fiscalParts" ? parseFloat(value) || 0 : value })
    }
  }

  const handleSelectChange = (value: "SASU" | "EURL") => {
    if (formData && formData.type === "company") {
      setFormData({ ...formData, legalStatus: value })
    }
  }

  const handleAvatarChange = (newAvatarProps: Partial<Avatar>) => {
    if (formData) {
      setFormData({ ...formData, avatar: { ...formData.avatar, ...newAvatarProps } })
    }
  }

  const handleSave = () => {
    if (formData) {
      if (formData.type === "person") {
        const updatedAvatar = updatePersonAvatar(formData.avatar, formData.name)
        onSave({ ...formData, avatar: updatedAvatar })
      } else {
        onSave(formData)
      }
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSave()
  }

  const handleAddRelationship = () => {
    if (!entity || !targetId || !relationshipType) return
    const newRelationship: Relationship = { id: `rel-${Date.now()}`, fromId: entity.id, toId: targetId, type: relationshipType as any }
    setRelationships(prev => [...prev, newRelationship])
    setAddingRelation(false)
    setTargetId(undefined)
    setRelationshipType(undefined)
  }

  const handleDeleteClick = (relation: Relationship) => {
    setRelationToDelete(relation)
    setDeleteAlertOpen(true)
  }

  const performDelete = () => {
    if (!relationToDelete) return
    setRelationships(prev => prev.filter(rel => rel.id !== relationToDelete.id))
    setDeleteAlertOpen(false)
    setRelationToDelete(null)
  }

  if (!formData || !entity) return null

  const relevantRelationships = relationships.filter(r => r.fromId === entity.id || r.toId === entity.id)

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle>Modifier : {formData.name}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Nom
                </Label>
                <Input id="name" name="name" value={formData.name || ""} onChange={handleChange} className="col-span-3" />
              </div>
              {formData.type === "person" && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="fiscalParts" className="text-right">
                    Parts
                  </Label>
                  <Input id="fiscalParts" name="fiscalParts" type="number" step="0.5" value={(formData as Person).fiscalParts || 1} onChange={handleChange} className="col-span-3" />
                </div>
              )}
              {formData.type === "company" && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="legalStatus" className="text-right">
                    Statut
                  </Label>
                  <Select value={(formData as Company).legalStatus} onValueChange={handleSelectChange}>
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
                    <button type="button" key={color} onClick={() => handleAvatarChange({ color })} className={`h-8 w-8 rounded-full border-2 transition-all ${formData.avatar.color === color ? "border-primary ring-2 ring-ring" : "border-transparent"}`} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              {formData.type !== "person" && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Icône</Label>
                  <div className="col-span-3 flex gap-2">
                    {Object.entries(availableIconsSmall).map(([key, icon]) => (
                      <button type="button" key={key} onClick={() => handleAvatarChange({ value: key, type: "icon" })} className={`flex h-10 w-10 items-center justify-center rounded-md border-2 transition-all ${formData.avatar.value === key ? "border-primary ring-2 ring-ring bg-secondary" : "border-transparent hover:bg-secondary/80"}`}>
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
                    const isSource = rel.fromId === entity.id
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
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteClick(rel)}>
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
                    <Select value={relationshipType} onValueChange={setRelationshipType} disabled={!targetId || availableTypes.length === 0}>
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

      <Dialog open={isDeleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>Êtes-vous sûr de vouloir supprimer cette relation ? Cette action est irréversible et pourrait affecter vos calculs si des flux financiers en dépendent.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAlertOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={performDelete}>
              Supprimer la relation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default EditEntityModal
