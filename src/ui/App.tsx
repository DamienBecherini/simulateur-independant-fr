// src/ui/App.tsx

import EntitiesManager from "./components/EntitiesManager"
import ThemeSwitcher from "./components/ThemeSwitcher"
import Footer from "./components/Footer"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsSheet } from "./components/SettingsSheet"
import { useState } from "react"

function App() {
  // L'état 'entities' est maintenant géré ici, au plus haut niveau
  const [entities, setEntities] = useState<Entity[]>([])
  const [isSettingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="container mx-auto p-8 relative min-h-screen flex flex-col">
      <div className="absolute top-4 right-4 flex gap-2">
        {/* Bouton pour ouvrir le panneau de configuration */}
        <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-[1.2rem] w-[1.2rem]" />
        </Button>
        <ThemeSwitcher />
      </div>

      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold">Simulateur Indépendant FR</h1>
        <p className="text-lg text-slate-500">Votre bac à sable financier, juridique et fiscal</p>
      </header>

      <main className="flex-grow">
        {/* On passe l'état et la fonction pour le modifier à EntitiesManager */}
        <EntitiesManager entities={entities} setEntities={setEntities} />
      </main>

      <Footer />

      {/* On inclut notre panneau latéral */}
      <SettingsSheet isOpen={isSettingsOpen} onOpenChange={setSettingsOpen} entities={entities} onStateImported={setEntities} />
    </div>
  )
}

export default App
