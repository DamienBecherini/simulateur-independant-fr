// src/ui/App.tsx

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import EntitiesManager from "./components/EntitiesManager"
import { ThemeToggle } from "./components/ThemeToggle"
import Footer from "./components/Footer"
import { Settings, Undo2, Redo2, ZoomIn, ZoomOut, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsSheet } from "./components/SettingsSheet"
import MonthlyGrid from "./components/MonthlyGrid"
import { useSessionManager } from "./hooks/useSessionManager"
import * as SessionService from "@/lib/session-service"
import type { SaveSlot, SimulationPluriannuelle } from "@/types"
import { ajouterAnnee, anneeAAjouter, anneeExistante, anneesDeLaSession, donneesDeLAnnee, remplacerGrille, supprimerAnnee, vueDeLAnnee } from "@/backend/logic/annees"
import { PREMIERE_ANNEE_DES_REGLES } from "@/backend/logic/regles"
import { createId } from "@/lib/id"
import { SelecteurAnnee } from "./components/SelecteurAnnee"
import { SyntheseDesAnnees } from "./components/SyntheseDesAnnees"
import { ResultsPanel } from "./components/ResultsPanel"
import { ComparatorPanel } from "./components/ComparatorPanel"
import { FlowLegend } from "./components/FlowLegend"
import { DevWindowSize } from "./components/DevWindowSize"
import { BandeauDemo } from "@/web/BandeauDemo"
import { useZoom } from "./hooks/useZoom"
import { ExportDialog } from "./components/ExportDialog"
import { dateDuDocument, styleDesPages } from "./impression"
import { SelecteurAffichage } from "./components/SelecteurAffichage"
import { BarreDeResume } from "./components/BarreDeResume"
import { ReplieEnResume } from "./components/ReplieEnResume"
import { AffichageContext } from "./hooks/useAffichage"
import { MemoireDesSectionsContext, useMemoireDesSections } from "./hooks/useSectionOuverte"
import { SectionMemorisee } from "./components/SectionMemorisee"
import { affichageApplicable, avecPanneaux, avecResume, avecVues } from "@/lib/affichage"
import { useVues, VuesContext } from "./hooks/useVues"
import { VueDeLaPage } from "./components/VuesDeLaPage"
import { InspecteurContext, useComparerLesStatuts, useEtatDeLInspecteur, type Inspecteur } from "./hooks/useInspecteur"
import { PanneauDActeur } from "./components/PanneauDActeur"
import type { ResumeDeLaComparaison } from "@/lib/resume"
import type { Affichage } from "@/types"
import { cn } from "@/lib/utils"

/** En-tête de la page : dans l'affichage « Résumé », un titre plus petit et sans sous-titre à l'écran. */
const EN_TETE_CLASSIQUE = { header: "mb-10", titre: "text-4xl", sousTitre: "" }
const EN_TETE_RESUME = { header: "mb-4", titre: "text-2xl sm:text-3xl print:text-4xl", sousTitre: "hidden print:block" }

/**
 * Affichage « Panneaux » : le contenu et, sur ordinateur, le panneau de l'acteur ouvert à sa droite, collé sous le
 * résumé ; sur téléphone, le panneau se pose en bas de l'écran. Dans les autres affichages, le contenu seul, tel quel.
 */
function AvecPanneau({ inspecteur, panneau, children }: { inspecteur: Inspecteur | null; panneau: (acteurId: string, fermer: () => void) => ReactNode; children: ReactNode }) {
  // Le contenu garde sa place dans l'arbre à l'ouverture du panneau : il n'est pas recréé, ses sections dépliées le restent.
  if (!inspecteur) return <>{children}</>
  return (
    <InspecteurContext.Provider value={inspecteur}>
      <div className="flex-grow lg:flex lg:items-start lg:gap-6">
        {children}
        {inspecteur.acteurOuvert ? panneau(inspecteur.acteurOuvert, inspecteur.fermer) : null}
      </div>
    </InspecteurContext.Provider>
  )
}

function App() {
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [isExportOpen, setExportOpen] = useState(false)
  const [simulation, setSimulation] = useState<SimulationPluriannuelle | null>(null)
  const [simulationError, setSimulationError] = useState<string | null>(null)

  // --- MODIFICATION : Récupération des nouveaux états et fonctions du hook ---
  // On récupère tout ce dont on a besoin depuis le "cerveau" de l'application.
  const { currentSession, setCurrentSession, setComparateur, allSaveSlots, setAllSaveSlots, slotOrder, setSlotOrder, userPreferences, setUserPreferences, importConfirmation, handleImport, proceedWithImport, cancelImport, handleResetSession, canUndo, canRedo, undo, redo, loadedSlotId, setLoadedSlotId, handleLoadSlot } = useSessionManager()

  // L'année affichée : celle de la grille, des résultats, du comparateur et des exports. Elle n'est pas enregistrée
  // dans la session (voir l'ADR 008) ; par défaut, ou si elle disparaît, c'est la plus récente.
  const [anneeChoisie, setAnneeChoisie] = useState<number | null>(null)
  const annee = anneeExistante(currentSession, anneeChoisie)
  const vue = useMemo(() => vueDeLAnnee(currentSession, annee), [currentSession, annee])
  const resultatDeLAnnee = simulation?.annees.find(a => a.annee === annee)
  const simulationReport = resultatDeLAnnee?.report ?? null
  const erreurDeLAnnee = simulationError ?? resultatDeLAnnee?.erreur ?? null

  // Affichage de la page choisi pendant la bêta : une préférence de l'utilisateur, pas une donnée de la simulation.
  const affichage = affichageApplicable(userPreferences.affichage)
  const resume = avecResume(affichage)
  // Affichage « Panneaux » : l'acteur dont le panneau est ouvert, quelle que soit l'année affichée.
  const inspecteur = useEtatDeLInspecteur(useMemo(() => currentSession.entities.map(e => e.id), [currentSession.entities]), avecPanneaux(affichage))
  const comparerLesStatuts = useComparerLesStatuts(setComparateur)
  // Affichage « Trois vues » : la vue affichée, suivie dans l'adresse de la page.
  const vues = useVues(avecVues(affichage), currentSession.name)
  const choisirAffichage = useCallback((choix: Affichage) => setUserPreferences(prefs => ({ ...prefs, affichage: choix })), [setUserPreferences])
  // Le zoom choisi est retenu dans les préférences, d'une ouverture à l'autre.
  const { zoomIn, zoomOut, canZoomIn, canZoomOut } = useZoom(userPreferences.zoom ?? 1, zoom => setUserPreferences(prefs => ({ ...prefs, zoom })))
  // Sections repliables ouvertes ou fermées, retenues dans les préférences (voir useSectionOuverte).
  const memoireDesSections = useMemoireDesSections(userPreferences.sectionsOuvertes, setUserPreferences)
  // Dans l'affichage « Résumé », le comparateur transmet son meilleur statut à la barre de résumé.
  const [comparaison, setComparaison] = useState<ResumeDeLaComparaison | null>(null)
  const enTete = resume ? EN_TETE_RESUME : EN_TETE_CLASSIQUE

  // La simulation de toutes les années est recalculée automatiquement, peu après chaque modification de la session.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const resultat = await window.api.simulerLesAnnees(currentSession)
        if (cancelled) return
        setSimulation(resultat)
        setSimulationError(null)
      } catch (e) {
        if (cancelled) return
        setSimulationError(e instanceof Error ? e.message : "La simulation a échoué.")
        setSimulation(null)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [currentSession])

  const handleExportAll = useCallback(async () => {
    const exportPayload = {
      ...SessionService.contenuDeLaSession(currentSession),
      simulation,
      simulationError,
      exportedAt: new Date().toISOString()
    }

    await window.api.exportState(exportPayload)
  }, [currentSession, simulation, simulationError])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
      const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey

      if (ctrlOrCmd && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) {
          if (canRedo) redo()
        } else {
          if (canUndo) undo()
        }
      } else if (ctrlOrCmd && event.key.toLowerCase() === "y" && !isMac) {
        event.preventDefault()
        if (canRedo) redo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [undo, redo, canUndo, canRedo])

  // --- SUPPRESSION : La logique de chargement est maintenant entièrement dans le hook useSessionManager ---
  // L'ancienne fonction handleLoadSlot qui était ici est supprimée.

  const handleConfirmImportAndClose = () => {
    proceedWithImport()
    setSettingsOpen(false)
  }

  const handleResetAndClose = () => {
    handleResetSession()
    setSettingsOpen(false)
  }

  // --- MODIFICATION : On utilise la fonction de chargement du hook et on ferme le panneau. ---
  // Cette fonction "wrapper" permet de coupler l'action de chargement avec la fermeture de l'UI.
  const handleLoadAndClose = (slotToLoad: SaveSlot) => {
    handleLoadSlot(slotToLoad)
    setSettingsOpen(false)
  }


  const flowTypeToNumberMap = useMemo(() => {
    const types = new Set<string>()
    // La légende numérote les types de flux de la grille affichée, celle de l'année choisie.
    vue.monthlyData.forEach(month => {
      month.flows.forEach(flow => types.add(flow.type))
    })
    const sortedTypes = Array.from(types).sort((a, b) => a.localeCompare(b))

    const map = new Map<string, number>()
    sortedTypes.forEach((type, index) => {
      map.set(type, index + 1)
    })
    return map
  }, [vue.monthlyData])

  return (
    <AffichageContext.Provider value={affichage}>
    <MemoireDesSectionsContext.Provider value={memoireDesSections}>
    <VuesContext.Provider value={vues}>
      <div className="container mx-auto px-4 py-8 sm:p-8 min-h-screen flex flex-col print:min-h-0 print:max-w-none print:p-0">
        {/* Barre de menu sticky */}
        {/* Lien d'évitement : invisible tant qu'il n'a pas le focus, il mène au contenu sans traverser la barre d'outils. */}
        <a href="#contenu" className="print:hidden sr-only z-[60] rounded-md bg-background px-4 py-2 font-medium shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
          Aller au contenu
        </a>
        <nav aria-label="Barre d'outils" className="print:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-2 backdrop-blur-sm bg-background/80 border-b">
          <div className="container mx-auto flex items-center justify-between px-0 py-2 sm:px-8">
            {/* Groupe de boutons de gauche */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Paramètres" className="h-10 w-9 sm:w-10 [&_svg]:size-6" onClick={() => setSettingsOpen(true)}>
                <Settings className="text-slate-600 dark:text-slate-400" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Annuler" title="Annuler (Ctrl+Z)" onClick={undo} disabled={!canUndo} className="h-10 w-9 sm:w-10 [&_svg]:size-6 sm:ml-2">
                <Undo2 className="dark:text-slate-300" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Rétablir" title="Rétablir (Ctrl+Y)" onClick={redo} disabled={!canRedo} className="h-10 w-9 sm:w-10 [&_svg]:size-6">
                <Redo2 className="dark:text-slate-300" />
              </Button>
            </div>
            {/* Groupe de boutons de droite */}
            <div className="flex items-center gap-1">
              <SelecteurAffichage affichage={affichage} onChange={choisirAffichage} />
              <Button variant="outline" size="sm" aria-label="Exporter" className="h-8 gap-2 pointer-coarse:min-w-11 sm:mr-2" onClick={() => setExportOpen(true)}>
                <Download className="size-4" />
                <span className="hidden sm:inline">Exporter</span>
              </Button>
              {/* Sur un téléphone tactile, on zoome avec les doigts : les boutons de zoom y laissent la place aux autres. */}
              <Button variant="ghost" size="icon" aria-label="Zoom arrière" onClick={zoomOut} disabled={!canZoomOut} className="h-10 w-9 pointer-coarse:max-sm:hidden sm:w-10 [&_svg]:size-6">
                <ZoomOut className="text-slate-600 dark:text-slate-400" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Zoom avant" onClick={zoomIn} disabled={!canZoomIn} className="h-10 w-9 pointer-coarse:max-sm:hidden sm:w-10 [&_svg]:size-6 sm:mr-4">
                <ZoomIn className="text-slate-600 dark:text-slate-400" />
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </nav>

        <header className={cn("text-center pt-16 print:mb-6 print:pt-0", enTete.header)}>
          <h1 className={cn("font-bold", enTete.titre)}>{currentSession.name}</h1>
          <p className={cn("text-lg text-slate-600 dark:text-slate-400", enTete.sousTitre)}>Votre bac à sable financier, juridique et fiscal</p>
          {/* Sur papier, la date du document (les chiffres valent pour les données de ce jour-là), et l'en-tête des pages suivantes. */}
          <p className="hidden text-sm text-slate-600 print:block">Document du {dateDuDocument()}</p>
          <style>{styleDesPages(currentSession.name, dateDuDocument())}</style>
          {import.meta.env.VITE_CIBLE === "web" && <BandeauDemo />}
        </header>

        {resume ? <BarreDeResume report={simulationReport} annees={anneesDeLaSession(currentSession)} annee={annee} onAnnee={setAnneeChoisie} comparaison={comparaison} /> : null}

        <AvecPanneau inspecteur={inspecteur} panneau={(acteurId, fermer) => <PanneauDActeur acteurId={acteurId} session={currentSession} setSession={setCurrentSession} report={simulationReport} onFermer={fermer} onComparer={comparerLesStatuts} />}>
        {/* `min-w-0` : à côté du panneau, la grille défile dans sa largeur au lieu d'élargir la page. */}
        <main id="contenu" tabIndex={-1} className="min-w-0 flex-grow scroll-mt-20 focus:outline-none">
          {/* Affichage « Trois vues » : les acteurs et la grille, puis les résultats, puis le comparateur, chacun dans sa vue. */}
          <VueDeLaPage vue="situation">
            <EntitiesManager session={currentSession} setSession={setCurrentSession} />

            <MonthlyGrid
              entities={currentSession.entities}
              monthlyData={vue.monthlyData}
              setMonthlyData={newMonthlyDataOrUpdater => {
                setCurrentSession(prev => {
                  const actuelle = donneesDeLAnnee(prev, annee).monthlyData
                  const monthlyData = typeof newMonthlyDataOrUpdater === "function" ? newMonthlyDataOrUpdater(actuelle) : newMonthlyDataOrUpdater
                  // Données inchangées : la session est renvoyée telle quelle, sans créer d'entrée d'historique.
                  return remplacerGrille(prev, annee, monthlyData)
                })
              }}
              preferences={userPreferences}
              flowTypeToNumberMap={flowTypeToNumberMap}
              annee={annee}
              // Une opération appliquée aussi à d'autres années remplace toutes les années d'un coup : une seule étape d'annulation.
              annees={currentSession.annees}
              setAnnees={annees => setCurrentSession(prev => ({ ...prev, annees }))}
              selecteurAnnee={
                <SelecteurAnnee
                  annees={anneesDeLaSession(currentSession)}
                  annee={annee}
                  premiereAnneeConnue={PREMIERE_ANNEE_DES_REGLES}
                  onChange={setAnneeChoisie}
                  onAjouter={(position, copier) => {
                    // La nouvelle année est affichée tout de suite ; son numéro se déduit de la session actuelle.
                    setAnneeChoisie(anneeAAjouter(currentSession, position))
                    setCurrentSession(prev => ajouterAnnee(prev, position, copier, () => createId("flow")))
                  }}
                  onSupprimer={anneeASupprimer => setCurrentSession(prev => supprimerAnnee(prev, anneeASupprimer))}
                />
              }
            />

            <SectionMemorisee id="legende-des-flux">
              <ReplieEnResume titre="Légende des flux" className="mt-3 print:mt-2">
                <FlowLegend preferences={userPreferences} onPreferencesChange={setUserPreferences} flowTypeToNumberMap={flowTypeToNumberMap} />
              </ReplieEnResume>
            </SectionMemorisee>
          </VueDeLaPage>

          <VueDeLaPage vue="resultats">
            {/* Dans l'affichage « Résumé », la synthèse des années remonte sous le bilan, avant les cartes détaillées. */}
            <ResultsPanel report={simulationReport} error={erreurDeLAnnee} apresLeBilan={resume ? <SyntheseDesAnnees simulation={simulation} annee={annee} /> : null} />

            {resume ? null : <SyntheseDesAnnees simulation={simulation} annee={annee} />}
          </VueDeLaPage>

          <VueDeLaPage vue="comparer">
            <ComparatorPanel session={currentSession} annee={annee} onComparateurChange={setComparateur} onComparaison={resume ? setComparaison : undefined} />
          </VueDeLaPage>
        </main>
        </AvecPanneau>

        <Footer />

        {import.meta.env.DEV && <DevWindowSize />}

        {/* --- MODIFICATION : Passage des nouvelles props à SettingsSheet --- */}
        {/* On transmet l'ID du slot chargé et la fonction pour le modifier, afin que
            le panneau de configuration ait tout le contexte nécessaire. */}
        <ExportDialog isOpen={isExportOpen} onClose={() => setExportOpen(false)} session={currentSession} annee={annee} simulationReport={simulationReport} onExportJson={handleExportAll} />
        <SettingsSheet
          isOpen={isSettingsOpen}
          onOpenChange={setSettingsOpen}
          allSaveSlots={allSaveSlots}
          setAllSaveSlots={setAllSaveSlots}
          currentSession={currentSession}
          setCurrentSession={setCurrentSession}
          onReset={handleResetAndClose}
          onLoadSlot={handleLoadAndClose} // On passe la nouvelle fonction wrapper
          slotOrder={slotOrder}
          setSlotOrder={setSlotOrder}
          onImport={handleImport}
          importConfirmation={importConfirmation}
          onConfirmImport={handleConfirmImportAndClose}
          onCancelImport={cancelImport}
          // Ajout des props cruciales pour la nouvelle logique
          loadedSlotId={loadedSlotId}
          setLoadedSlotId={setLoadedSlotId}
        />
      </div>
    </VuesContext.Provider>
    </MemoireDesSectionsContext.Provider>
    </AffichageContext.Provider>
  )
}

export default App
