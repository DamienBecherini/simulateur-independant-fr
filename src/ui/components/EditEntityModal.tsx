// src/ui/components/EditEntityModal.tsx

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"

interface EditEntityModalProps {
  entity: Entity | null
  isOpen: boolean
  onClose: () => void
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

  // --- NOUVELLE FONCTION ---
  // Gère la soumission du formulaire
  const handleFormSubmit = (e: React.FormEvent) => {
    // Empêche le comportement par défaut du formulaire (qui est de recharger la page)
    e.preventDefault()
    // Appelle notre fonction de sauvegarde existante
    handleSave()
  }

  if (!formData) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        {/* La balise <form> commence ici et englobe les champs et le footer */}
        <form onSubmit={handleFormSubmit}>
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
              {/* Ce bouton reste de type "button" pour ne pas soumettre le formulaire */}
              <Button type="button" variant="secondary">
                Annuler
              </Button>
            </DialogClose>
            {/* --- MODIFICATION ICI --- */}
            {/* Ce bouton devient de type "submit" pour déclencher le onSubmit du formulaire */}
            <Button type="submit">Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default EditEntityModal
