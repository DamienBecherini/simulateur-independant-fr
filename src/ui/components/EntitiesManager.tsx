// src/ui/components/EntitiesManager.tsx

import { Button } from "@/components/ui/button"
import { useState } from "react"

// Les types n'ont pas changé
interface Person {
  id: string
  type: "person"
  name: string
  fiscalParts: number
}

interface Company {
  id: string
  type: "company"
  name: string
  legalStatus: "SASU" | "EURL"
}

type Entity = Person | Company

function EntitiesManager() {
  const [entities, setEntities] = useState<Entity[]>([])

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

  // --- NOUVELLE FONCTION ---
  // Prend en argument l'ID de l'entité à supprimer
  const deleteEntity = (idToDelete: string) => {
    // setEntities va recevoir une nouvelle liste
    // On utilise .filter() pour créer une nouvelle liste qui contient
    // toutes les entités SAUF celle dont l'id correspond à celui à supprimer.
    setEntities(prevEntities => prevEntities.filter(entity => entity.id !== idToDelete))
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
            <div key={entity.id} className="p-4 border rounded-md flex justify-between items-center">
              <div>
                <p className="font-bold">{entity.name}</p>
                <p className="text-sm text-slate-400">{entity.type === "person" ? `Personne physique - Parts: ${entity.fiscalParts}` : `Société - Statut: ${entity.legalStatus}`}</p>
              </div>
              {/* --- MODIFICATION ICI --- */}
              {/* On appelle notre nouvelle fonction deleteEntity au clic, */}
              {/* en lui passant l'id de l'entité de cette ligne. */}
              <Button variant="destructive" size="sm" onClick={() => deleteEntity(entity.id)}>
                Supprimer
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default EntitiesManager
