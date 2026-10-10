// src/ui/App.tsx

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import EntitiesManager from "./components/EntitiesManager"
import { ThemeToggle } from "./components/ThemeToggle"
import Footer from "./components/Footer"
import { MentionsLegalesParLAdresse } from "./components/MentionsLegales"
import { Settings, Undo2, Redo2, ZoomIn, ZoomOut, Download, MessageSquareHeart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsSheet } from "./components/SettingsSheet"
import { sessionDUnMontage, type MontageType } from "@/lib/montages/montages"
import MonthlyGrid from "./components/MonthlyGrid"
import { useSessionManager } from "./hooks/useSessionManager"
import * as SessionService from "@/lib/session-service"
import { BoutonDesMontages } from "./components/MontagesTypes"
import { BoutonDesTests } from "./components/BoutonDesTests"
import type { SaveSlot, SessionState, SimulationPluriannuelle } from "@/types"
import { ajouterAnnee, anneeAAjouter, anneeExistante, anneesDeLaSession, donneesDeLAnnee, remplacerGrille, supprimerAnnee, vueDeLAnnee } from "@/backend/logic/annees"
import { PREMIERE_ANNEE_DES_REGLES } from "@/backend/logic/regles"
import { createId } from "@/lib/id"
import { SelecteurAnnee } from "./components/SelecteurAnnee"
import { SyntheseDesAnnees } from "./components/SyntheseDesAnnees"
import { ResultsPanel } from "./components/ResultsPanel"
import { ComparatorPanel } from "./components/ComparatorPanel"
import { FlowLegend } from "./components/FlowLegend"
import { DevWindowSize } from "./components/DevWindowSize"
import { usePlateforme } from "./plateforme"
import { useZoom } from "./hooks/useZoom"
import { ExportDialog } from "./components/ExportDialog"
import { dateDuDocument, styleDesPages } from "./impression"
import { SelecteurAffichage } from "./components/SelecteurAffichage"
import { BarreDeResume } from "./components/BarreDeResume"
import { ReplieEnResume } from "./components/ReplieEnResume"
import { AffichageContext } from "./hooks/useAffichage"
import { MemoireDesSectionsContext, useMemoireDesSections } from "./hooks/useSectionOuverte"
import { affichageApplicable, avecResume, avecVues } from "@/lib/affichage"
import { useVues, VuesContext } from "./hooks/useVues"
import { VueDeLaPage } from "./components/VuesDeLaPage"
import { FournisseurDesDetails } from "./components/DetailsDesCartes"
import { DialogueDAvis } from "./components/DialogueDAvis"
import { ADRESSE_DE_L_AVIS, systemeEtNavigateur, type Diagnostic } from "@/lib/retours"
import { useFenetreParLAdresse } from "./hooks/useFenetreParLAdresse"
import { VERSION_DE_L_APPLICATION } from "@/lib/version"
import type { ResumeDeLaComparaison } from "@/lib/resume"
import type { Affichage } from "@/types"
import { cn } from "@/lib/utils"
import { RelectureDesPropositions } from "./components/RelectureDesPropositions"
import { usePropositionsEnAttente } from "./hooks/usePropositionsEnAttente"
import { useRaccourcisDAnnulation } from "./hooks/useRaccourcisDAnnulation"
import { numerosDesTypesDeFlux } from "@/lib/grille-mensuelle"

/** En-tête de la page : dans l'affichage « Résumé », un titre plus petit et sans sous-titre à l'écran. */
const EN_TETE_CLASSIQUE = { header: "mb-10", titre: "text-4xl", sousTitre: "" }
const EN_TETE_RESUME = { header: "mb-4", titre: "text-2xl sm:text-3xl print:text-4xl", sousTitre: "hidden print:block" }

/** Rapport et erreur de l'année affichée ; une simulation qui a échoué en entier donne son erreur à chaque année. */
function resultatsDeLAnnee(simulation: SimulationPluriannuelle | null, erreurDeLaSimulation: string | null, annee: number) {
  const resultat = simulation?.annees.find(a => a.annee === annee)
  return { report: resultat?.report ?? null, erreur: erreurDeLaSimulation ?? resultat?.erreur ?? null }
}

function App() {
  // Démo web ou application de bureau : fournie par la racine de composition (main.tsx de chaque cible).
  const plateforme = usePlateforme()
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [isExportOpen, setExportOpen] = useState(false)
  // La fenêtre d'avis s'ouvre par son bouton, ou par l'adresse #donner-mon-avis (lien de la page outil du site).
  const [isAvisOpen, setAvisOpen] = useFenetreParLAdresse(ADRESSE_DE_L_AVIS)
  const boutonDAvis = useRef<HTMLButtonElement>(null)
  const [simulation, setSimulation] = useState<SimulationPluriannuelle | null>(null)
  const [simulationError, setSimulationError] = useState<string | null>(null)

  // Session, historique d'annulation, sauvegardes et préférences (voir useSessionManager).
  const { currentSession, setCurrentSession, setComparateur, allSaveSlots, setAllSaveSlots, setSlotOrder, userPreferences, setUserPreferences, importConfirmation, handleImport, proceedWithImport, cancelImport, handleResetSession, handleLoadMontage, canUndo, canRedo, undo, redo, loadedSlotId, setLoadedSlotId, handleLoadSlot, sessionChargee } = useSessionManager()

  // Propositions d'un client d'IA déposées par le serveur MCP local (application de bureau seulement, voir l'ADR 011).
  const { propositions, retirer: retirerProposition } = usePropositionsEnAttente(sessionChargee)

  // L'année affichée : celle de la grille, des résultats, du comparateur et des exports. Elle n'est pas enregistrée
  // dans la session (voir l'ADR 008) ; par défaut, ou si elle disparaît, c'est la plus récente.
  const [anneeChoisie, setAnneeChoisie] = useState<number | null>(null)
  const annee = anneeExistante(currentSession, anneeChoisie)
  const vue = useMemo(() => vueDeLAnnee(currentSession, annee), [currentSession, annee])
  const { report: simulationReport, erreur: erreurDeLAnnee } = resultatsDeLAnnee(simulation, simulationError, annee)

  // Affichage de la page choisi pendant la bêta : une préférence de l'utilisateur, pas une donnée de la simulation.
  const affichage = affichageApplicable(userPreferences.affichage)
  const resume = avecResume(affichage)
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
  // Diagnostic proposé avec un avis : aucune donnée de la simulation, seulement des nombres d'années et d'acteurs.
  const diagnostic: Diagnostic = { version: VERSION_DE_L_APPLICATION, web: plateforme.web, installee: plateforme.installee(), ...systemeEtNavigateur(navigator.userAgent), affichageEnCours: affichage, nombreDAnnees: currentSession.annees.length, nombreDActeurs: currentSession.entities.length }

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

  // Ctrl+Z / Ctrl+Y : l'historique de la simulation, sauf dans un champ où l'on écrit (il garde sa propre annulation).
  useRaccourcisDAnnulation({ annuler: undo, retablir: redo, peutAnnuler: canUndo, peutRetablir: canRedo })

  const handleConfirmImportAndClose = () => {
    proceedWithImport()
    setSettingsOpen(false)
  }

  const handleResetAndClose = () => {
    handleResetSession()
    setSettingsOpen(false)
  }

  // Une sauvegarde chargée depuis le panneau des paramètres le ferme.
  const handleLoadAndClose = (slotToLoad: SaveSlot) => {
    handleLoadSlot(slotToLoad)
    setSettingsOpen(false)
  }

  // Un montage type (ou un scénario de test) remplace la session, nommée d'après lui ; la page remonte en haut, sur ses acteurs.
  const chargerUneSession = (session: SessionState) => {
    handleLoadMontage(session)
    setSettingsOpen(false)
    window.scrollTo(0, 0)
  }
  const chargerUnMontage = (montage: MontageType) => chargerUneSession(sessionDUnMontage(montage))

  // La légende et la grille numérotent les types de flux de la grille affichée, celle de l'année choisie.
  const flowTypeToNumberMap = useMemo(() => numerosDesTypesDeFlux(vue.monthlyData), [vue.monthlyData])

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
              {/* Sur un écran large, les deux boutons les plus utiles à qui découvre le simulateur montrent leur nom ;
                  en dessous, leur icône seule, pour que la barre tienne sur un téléphone. Sous 352 px, les montages ne
                  restent que dans le panneau des paramètres. */}
              <Button variant="ghost" size="icon" ref={boutonDAvis} aria-label="Donner mon avis" title="Donner mon avis" onClick={() => setAvisOpen(true)} className="h-10 w-9 sm:ml-2 sm:w-10 lg:w-auto lg:gap-2 lg:px-3 [&_svg]:size-6">
                <MessageSquareHeart className="text-slate-600 dark:text-slate-400" />
                <span className="hidden lg:inline">Donner mon avis</span>
              </Button>
              <BoutonDesMontages variant="outline" size="sm" aria-label="Montages types" className="ml-1 h-8 gap-2 pointer-coarse:min-w-11 max-[22rem]:hidden sm:ml-2" onCharger={chargerUnMontage} confirmationNecessaire={SessionService.modificationsNonEnregistrees(currentSession, allSaveSlots, loadedSlotId)} nomDeLaSession={currentSession.name}>
                <span className="hidden md:inline">Montages types</span>
              </BoutonDesMontages>
              {/* En mode développement seulement : scénarios prêts à charger pour vérifier une fonctionnalité. */}
              <BoutonDesTests onCharger={chargerUneSession} />
            </div>
            {/* Groupe de boutons de droite */}
            <div className="flex items-center gap-1">
              <SelecteurAffichage affichage={affichage} onChange={choisirAffichage} />
              <Button variant="outline" size="sm" aria-label="Exporter" className="h-8 gap-2 pointer-coarse:min-w-11 sm:mr-2" onClick={() => setExportOpen(true)}>
                <Download className="size-4" />
                <span className="hidden sm:inline">Exporter</span>
              </Button>
              {/* Sur un téléphone tactile, on zoome avec les doigts : les boutons de zoom y laissent la place aux autres. Dans
                  une fenêtre très étroite (moins de 416 px), ils s'effacent aussi : le zoom du navigateur reste. */}
              <Button variant="ghost" size="icon" aria-label="Zoom arrière" onClick={zoomOut} disabled={!canZoomOut} className="h-10 w-9 pointer-coarse:max-sm:hidden max-[26rem]:hidden sm:w-10 [&_svg]:size-6">
                <ZoomOut className="text-slate-600 dark:text-slate-400" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Zoom avant" onClick={zoomIn} disabled={!canZoomIn} className="h-10 w-9 pointer-coarse:max-sm:hidden max-[26rem]:hidden sm:w-10 [&_svg]:size-6 sm:mr-4">
                <ZoomIn className="text-slate-600 dark:text-slate-400" />
              </Button>
              {/* Sur un écran de moins de 352 px, l'interrupteur de thème passe dans le panneau des paramètres. */}
              <ThemeToggle className="max-[22rem]:hidden" />
            </div>
          </div>
        </nav>

        <header className={cn("text-center pt-16 print:mb-6 print:pt-0", enTete.header)}>
          <h1 className={cn("font-bold", enTete.titre)}>{currentSession.name}</h1>
          <p className={cn("text-lg text-slate-600 dark:text-slate-400", enTete.sousTitre)}>Votre bac à sable financier, juridique et fiscal</p>
          {/* Sur papier, la date du document (les chiffres valent pour les données de ce jour-là), et l'en-tête des pages suivantes. */}
          <p className="hidden text-sm text-slate-600 print:block">Document du {dateDuDocument()}</p>
          <style>{styleDesPages(currentSession.name, dateDuDocument())}</style>
          {plateforme.Bandeau && <plateforme.Bandeau />}
        </header>

        {resume ? <BarreDeResume report={simulationReport} annees={anneesDeLaSession(currentSession)} annee={annee} onAnnee={setAnneeChoisie} comparaison={comparaison} /> : null}

        {/* Le détail des cartes de résultats s'ouvre par groupe. */}
        <FournisseurDesDetails>
        <main id="contenu" tabIndex={-1} className="min-w-0 flex-grow scroll-mt-20 focus:outline-none">
          {/* Affichage « Trois vues » : les acteurs et la grille, puis les résultats, puis le comparateur, chacun dans sa vue. */}
          <VueDeLaPage vue="situation">
            <EntitiesManager session={currentSession} setSession={setCurrentSession} annee={annee} onChargerMontage={chargerUnMontage} />

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

            <ReplieEnResume titre="Légende des flux" id="legende-des-flux" className="mt-3 print:mt-2">
              <FlowLegend preferences={userPreferences} onPreferencesChange={setUserPreferences} flowTypeToNumberMap={flowTypeToNumberMap} />
            </ReplieEnResume>
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
        </FournisseurDesDetails>

        <Footer />
        <MentionsLegalesParLAdresse />

        {import.meta.env.DEV && <DevWindowSize />}

        {/* Appliquer une proposition remplace la session comme toute modification : une seule étape d'annulation. Rien
            n'est montré avant le chargement de la session : la proposition paraîtrait périmée. */}
        <RelectureDesPropositions session={currentSession} propositions={propositions} onAppliquer={setCurrentSession} onRetirer={retirerProposition} />
        <DialogueDAvis isOpen={isAvisOpen} onClose={() => setAvisOpen(false)} diagnostic={diagnostic} declencheur={boutonDAvis} />
        <ExportDialog isOpen={isExportOpen} onClose={() => setExportOpen(false)} session={currentSession} annee={annee} simulationReport={simulationReport} simulation={simulation} onExportJson={handleExportAll} />
        <SettingsSheet
          isOpen={isSettingsOpen}
          onOpenChange={setSettingsOpen}
          allSaveSlots={allSaveSlots}
          setAllSaveSlots={setAllSaveSlots}
          currentSession={currentSession}
          setCurrentSession={setCurrentSession}
          onReset={handleResetAndClose}
          onLoadSlot={handleLoadAndClose}
          slotOrder={userPreferences.slotOrder}
          setSlotOrder={setSlotOrder}
          onImport={handleImport}
          onLoadMontage={chargerUnMontage}
          importConfirmation={importConfirmation}
          onConfirmImport={handleConfirmImportAndClose}
          onCancelImport={cancelImport}
          // La sauvegarde chargée : « Sauvegarder » la met à jour au lieu d'en créer une autre.
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
