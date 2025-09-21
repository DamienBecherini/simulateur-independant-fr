// src/ui/App.tsx

import EntitiesManager from "./components/EntitiesManager"
import ThemeSwitcher from "./components/ThemeSwitcher"
import Footer from "./components/Footer" // <-- AJOUTER CET IMPORT

function App() {
  return (
    // On ajoute 'relative' pour que le positionnement 'absolute' du ThemeSwitcher fonctionne bien
    <div className="container mx-auto p-8 relative min-h-screen flex flex-col">
      <div className="absolute top-4 right-4">
        <ThemeSwitcher />
      </div>

      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold">Simulateur Indépendant FR</h1>
        <p className="text-lg text-slate-500">Votre bac à sable financier, juridique et fiscal</p>
      </header>

      {/* 'flex-grow' permet au contenu principal de pousser le footer vers le bas */}
      <main className="flex-grow">
        <EntitiesManager />
      </main>

      {/* On ajoute notre nouveau composant juste avant la fin */}
      <Footer />
    </div>
  )
}

export default App
