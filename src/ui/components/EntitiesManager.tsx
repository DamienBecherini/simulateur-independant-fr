// src/ui/components/EntitiesManager.tsx

import { Button } from "@/components/ui/button"
import { useState } from "react"
import EditEntityModal from "./EditEntityModal"

// Les types n'ont pas changé
export interface Person {
  id: string
  type: "person"
  name: string
  fiscalParts: number
}

export interface Company {
  id: string
  type: "company"
  name: string
  legalStatus: "SASU" | "EURL"
}

export type Entity = Person | Company

function EntitiesManager() {
  const [entities, setEntities] = useState<Entity[]>([])
  // --- 3. AJOUTER L'ÉTAT POUR GÉRER LA MODALE ---
  // Il contiendra l'entité en cours d'édition, ou null si la modale est fermée.
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)

  const addPerson = () => {
    const newPerson: Person = {
      id: `person-${Date.now()}`,
      type: "person",
      name: "Nouvelle Personne",
      fiscalParts: 1
    }
    setEntities(prevEntities => [...prevEntities, newPerson])
  }

  const addCompany = () => {
    const newCompany: Company = {
      id: `company-${Date.now()}`,
      type: "company",
      name: "Nouvelle Société",
      legalStatus: "SASU"
    }
    setEntities(prevEntities => [...prevEntities, newCompany])
  }

  // Prend en argument l'ID de l'entité à supprimer
  const deleteEntity = (idToDelete: string) => {
    // setEntities va recevoir une nouvelle liste
    // On utilise .filter() pour créer une nouvelle liste qui contient
    // toutes les entités SAUF celle dont l'id correspond à celui à supprimer.
    setEntities(prevEntities => prevEntities.filter(entity => entity.id !== idToDelete))
  }

  // --- 4. AJOUTER LA FONCTION DE MISE À JOUR ---
  const handleUpdateEntity = (updatedEntity: Entity) => {
    setEntities(prevEntities =>
      // On parcourt la liste et on remplace l'ancienne version de l'entité par la nouvelle
      prevEntities.map(entity => (entity.id === updatedEntity.id ? updatedEntity : entity))
    )
    setEditingEntity(null) // On ferme la modale après avoir sauvegardé
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-900 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4">Gestion des Entités</h2>

      <div className="flex gap-4 mb-6">
        <Button onClick={addPerson}>+ Ajouter une Personne</Button>
        <Button onClick={addCompany} variant="secondary">
          + Ajouter une Société
        </Button>
      </div>

      <div className="space-y-4">
        {entities.length === 0 ? (
          <p className="text-slate-500">Aucune entité pour le moment. Commencez par en ajouter une !</p>
        ) : (
          entities.map(entity => (
            <div key={entity.id} className="p-4 border rounded-md flex justify-between items-center transition-all hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer" onClick={() => setEditingEntity(entity)}>
              <div>
                <p className="font-bold">{entity.name}</p>
                <p className="text-sm text-slate-400">{entity.type === "person" ? `Personne physique - Parts: ${entity.fiscalParts}` : `Société - Statut: ${entity.legalStatus}`}</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={e => {
                  e.stopPropagation() // Empêche le clic de se propager et d'ouvrir la modale
                  deleteEntity(entity.id)
                }}
              >
                Supprimer
              </Button>
            </div>
          ))
        )}
      </div>
      <EditEntityModal
        isOpen={!!editingEntity} // La modale est ouverte si editingEntity n'est pas null
        entity={editingEntity}
        onClose={() => setEditingEntity(null)} // Pour fermer la modale
        onSave={handleUpdateEntity} // Pour sauvegarder les changements
      />
    </div>
  )
}

export default EntitiesManager
