// src/ui/components/EditEntityModal.tsx

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
// On importe les types depuis leur fichier d'origine
import type { Entity, Person, Company } from "./EntitiesManager"

// On définit les "props" que notre modale attend
interface EditEntityModalProps {
  entity: Entity | null
  isOpen: boolean
  onClose: () => void
  // --- ERREUR CORRIGÉE ICI : '=>' au lieu de '->' ---
  onSave: (updatedEntity: Entity) => void
}

function EditEntityModal({ entity, isOpen, onClose, onSave }: EditEntityModalProps) {
  const [formData, setFormData] = useState<Entity | null>(null)

  useEffect(() => {
    setFormData(entity)
  }, [entity])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (formData) {
      setFormData({
        ...formData,
        [name]: name === "fiscalParts" ? parseFloat(value) || 0 : value
      })
    }
  }

  const handleSelectChange = (value: "SASU" | "EURL") => {
    if (formData && formData.type === "company") {
      setFormData({ ...formData, legalStatus: value })
    }
  }

  const handleSave = () => {
    if (formData) {
      onSave(formData)
    }
  }

  if (!formData) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifier {formData.type === "person" ? "la Personne" : "la Société"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nom
            </Label>
            <Input id="name" name="name" value={formData.name || ""} onChange={handleChange} className="col-span-3" />
          </div>

          {formData.type === "person" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fiscalParts" className="text-right">
                Parts Fiscales
              </Label>
              <Input id="fiscalParts" name="fiscalParts" type="number" value={(formData as Person).fiscalParts || 1} onChange={handleChange} className="col-span-3" />
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
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Annuler
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSave}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default EditEntityModal
