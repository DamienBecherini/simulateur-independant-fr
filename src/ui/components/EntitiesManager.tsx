// src/ui/components/EntitiesManager.tsx

import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import EditEntityModal from "./EditEntityModal"

function EntitiesManager() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)

  // --- DÉBUT DE LA NOUVELLE LOGIQUE DE PERSISTANCE ---

  // 1. CHARGEMENT INITIAL
  // Ce useEffect s'exécute UNE SEULE FOIS au chargement du composant
  useEffect(() => {
    const loadState = async () => {
      console.log("Demande de l'état initial au backend...")
      const savedEntities = await window.api.getState()
      setEntities(savedEntities)
      console.log("État initial chargé :", savedEntities)
    }
    loadState()
  }, []) // Le tableau de dépendances vide signifie "exécute seulement au montage"

  // 2. SAUVEGARDE AUTOMATIQUE
  // Ce useEffect s'exécute À CHAQUE FOIS que la variable 'entities' change
  useEffect(() => {
    // On ne sauvegarde pas lors du premier rendu (quand la liste est vide et qu'on attend les données)
    if (entities.length > 0) {
      console.log("L'état a changé, envoi des nouvelles données au backend...")
      window.api.saveState(entities)
    }
  }, [entities]) // Le tableau de dépendances contient 'entities'

  // --- FIN DE LA NOUVELLE LOGIQUE DE PERSISTANCE ---

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
