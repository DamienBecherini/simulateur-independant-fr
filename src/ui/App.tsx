// src/ui/App.tsx
// Racine de l'interface : la session et ses calculs, l'affichage choisi, et la page composée de la barre d'outils, de
// l'en-tête, de l'encart des questions, de la barre de résumé, des trois parties (situation, résultats, comparateur)
// et des fenêtres.

import { useState, useCallback, useMemo } from "react"
import EntitiesManager from "./components/EntitiesManager"
import Footer from "./components/Footer"
import { MentionsLegalesParLAdresse } from "./components/MentionsLegales"
import { SettingsSheet } from "./components/SettingsSheet"
import { sessionDUnMontage, type MontageType } from "@/lib/montages/montages"
import { useSessionManager } from "./hooks/useSessionManager"
import * as SessionService from "@/lib/session-service"
import { EncartDesQuestions } from "./components/EncartDesQuestions"
import { SituationParLAdresse } from "./components/SituationParLAdresse"
import type { Affichage, SaveSlot, SessionState } from "@/types"
import { anneeExistante, anneesDeLaSession, vueDeLAnnee } from "@/backend/logic/annees"
import { SyntheseDesAnnees } from "./components/SyntheseDesAnnees"
import { ResultsPanel } from "./components/ResultsPanel"
import { ComparatorPanel } from "./components/ComparatorPanel"
import { FlowLegend } from "./components/FlowLegend"
import { GrilleDeLAnnee } from "./components/GrilleDeLAnnee"
import { DevWindowSize } from "./components/DevWindowSize"
import { usePlateforme } from "./plateforme"
import { useZoom } from "./hooks/useZoom"
import { ExportDialog } from "./components/ExportDialog"
import { dateDuDocument, styleDesPages } from "./impression"
import { BarreDeResume } from "./components/BarreDeResume"
import { BarreDOutils } from "./components/BarreDOutils"
import { ReplieEnResume } from "./components/ReplieEnResume"
import { AffichageContext } from "./hooks/useAffichage"
import { MemoireDesSectionsContext, useMemoireDesSections } from "./hooks/useSectionOuverte"
import { affichageApplicable, avecResume, avecVues } from "@/lib/affichage"
import { useVues, VuesContext } from "./hooks/useVues"
import { VueDeLaPage } from "./components/VuesDeLaPage"
import { FournisseurDesDetails } from "./components/DetailsDesCartes"
import type { ResumeDeLaComparaison } from "@/lib/resume"
import { cn } from "@/lib/utils"
import { ANCRES, lienVers } from "@/lib/ancres"
import { RelectureDesPropositions } from "./components/RelectureDesPropositions"
import { usePropositionsEnAttente } from "./hooks/usePropositionsEnAttente"
import { useRaccourcisDAnnulation } from "./hooks/useRaccourcisDAnnulation"
import { useSimulationDesAnnees } from "./hooks/useSimulationDesAnnees"
import { useEncartDesQuestions } from "./hooks/useEncartDesQuestions"
import { numerosDesTypesDeFlux } from "@/lib/grille-mensuelle"

/** En-tête de la page : dans l'affichage « Résumé », un titre plus petit et sans sous-titre à l'écran. */
const EN_TETE_CLASSIQUE = { header: "mb-10", titre: "text-4xl", sousTitre: "" }
const EN_TETE_RESUME = { header: "mb-4", titre: "text-2xl sm:text-3xl print:text-4xl", sousTitre: "hidden print:block" }

function App() {
  // Démo web ou application de bureau : fournie par la racine de composition (main.tsx de chaque cible).
  const plateforme = usePlateforme()
  const [isSettingsOpen, setSettingsOpen] = useState(false)
  const [isExportOpen, setExportOpen] = useState(false)

  // Session, historique d'annulation, sauvegardes et préférences (voir useSessionManager).
  const { currentSession, setCurrentSession, setComparateur, allSaveSlots, setAllSaveSlots, setSlotOrder, userPreferences, setUserPreferences, importConfirmation, handleImport, proceedWithImport, cancelImport, handleResetSession, handleLoadMontage, canUndo, canRedo, undo, redo, loadedSlotId, setLoadedSlotId, handleLoadSlot, sessionChargee } = useSessionManager()

  // Propositions d'un client d'IA déposées par le serveur MCP local (application de bureau seulement, voir l'ADR 011).
  const { propositions, retirer: retirerProposition } = usePropositionsEnAttente(sessionChargee)

  // L'année affichée : celle de la grille, des résultats, du comparateur et des exports. Elle n'est pas enregistrée
  // dans la session (voir l'ADR 008) ; par défaut, ou si elle disparaît, c'est la plus récente.
  const [anneeChoisie, setAnneeChoisie] = useState<number | null>(null)
  const annee = anneeExistante(currentSession, anneeChoisie)
  const vue = useMemo(() => vueDeLAnnee(currentSession, annee), [currentSession, annee])
  // La simulation de toutes les années, recalculée peu après chaque modification de la session.
  const { simulation, simulationError, report: simulationReport, erreurDeLAnnee } = useSimulationDesAnnees(currentSession, annee)

  // Affichage de la page choisi pendant la bêta : une préférence de l'utilisateur, pas une donnée de la simulation.
  const affichage = affichageApplicable(userPreferences.affichage)
  const resume = avecResume(affichage)
  // Affichage « Trois vues » : la vue affichée, suivie dans l'adresse de la page.
  const vues = useVues(avecVues(affichage), currentSession.name)
  const choisirAffichage = useCallback((choix: Affichage) => setUserPreferences(prefs => ({ ...prefs, affichage: choix })), [setUserPreferences])
  // Le zoom choisi est retenu dans les préférences, d'une ouverture à l'autre.
  const zoom = useZoom(userPreferences.zoom ?? 1, nouveau => setUserPreferences(prefs => ({ ...prefs, zoom: nouveau })))
  // Sections repliables ouvertes ou fermées, retenues dans les préférences (voir useSectionOuverte).
  const memoireDesSections = useMemoireDesSections(userPreferences.sectionsOuvertes, setUserPreferences)
  // Dans l'affichage « Résumé », le comparateur transmet son meilleur statut à la barre de résumé.
  const [comparaison, setComparaison] = useState<ResumeDeLaComparaison | null>(null)
  const enTete = resume ? EN_TETE_RESUME : EN_TETE_CLASSIQUE

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
  const historique = { annuler: undo, retablir: redo, peutAnnuler: canUndo, peutRetablir: canRedo }
  useRaccourcisDAnnulation(historique)

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
  // Remplacer la session (montage type, simulation vierge) perdrait des modifications : une confirmation d'abord.
  const confirmationNecessaire = SessionService.modificationsNonEnregistrees(currentSession, allSaveSlots, loadedSlotId)

  // L'encart des questions de départ, sur une simulation vide ou sur l'exemple du premier lancement.
  const questions = useEncartDesQuestions({ session: currentSession, sessionChargee, preferences: userPreferences, setPreferences: setUserPreferences, reinitialiser: handleResetSession, vues })

  // La légende et la grille numérotent les types de flux de la grille affichée, celle de l'année choisie.
  const flowTypeToNumberMap = useMemo(() => numerosDesTypesDeFlux(vue.monthlyData), [vue.monthlyData])

  return (
    <AffichageContext.Provider value={affichage}>
    <MemoireDesSectionsContext.Provider value={memoireDesSections}>
    <VuesContext.Provider value={vues}>
      <div className="container mx-auto px-4 py-8 sm:p-8 min-h-screen flex flex-col print:min-h-0 print:max-w-none print:p-0">
        {/* Lien d'évitement : invisible tant qu'il n'a pas le focus, il mène au contenu sans traverser la barre d'outils. */}
        <a href={lienVers(ANCRES.contenu)} className="print:hidden sr-only z-[60] rounded-md bg-background px-4 py-2 font-medium shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
          Aller au contenu
        </a>
        <BarreDOutils
          session={currentSession}
          historique={historique}
          chargement={{ onChargerUnMontage: chargerUnMontage, onChargerUneSession: chargerUneSession, confirmationNecessaire }}
          affichage={affichage}
          onAffichage={choisirAffichage}
          zoom={zoom}
          onParametres={() => setSettingsOpen(true)}
          onExporter={() => setExportOpen(true)}
        />

        <header className={cn("text-center pt-16 print:mb-6 print:pt-0", enTete.header)}>
          <h1 className={cn("font-bold", enTete.titre)}>{currentSession.name}</h1>
          <p className={cn("text-lg text-slate-600 dark:text-slate-400", enTete.sousTitre)}>Votre bac à sable financier, juridique et fiscal</p>
          {/* Sur papier, la date du document (les chiffres valent pour les données de ce jour-là), et l'en-tête des pages suivantes. */}
          <p className="hidden text-sm text-slate-600 print:block">Document du {dateDuDocument()}</p>
          <style>{styleDesPages(currentSession.name, dateDuDocument())}</style>
          {plateforme.Bandeau && <plateforme.Bandeau />}
        </header>

        {/* Démo web : l'adresse #situation=… ouvre une situation type ; une fois chargée, l'encart des questions n'a plus lieu d'être. */}
        <SituationParLAdresse session={currentSession} sessionChargee={sessionChargee} confirmationNecessaire={confirmationNecessaire} onCharger={chargerUnMontage} />

        {questions.affiche ? <EncartDesQuestions onCharger={chargerUnMontage} onPartirDeZero={questions.partirDeZero} onFermer={questions.fermer} confirmationNecessaire={confirmationNecessaire} nomDeLaSession={currentSession.name} /> : null}

        {resume ? <BarreDeResume report={simulationReport} annees={anneesDeLaSession(currentSession)} annee={annee} onAnnee={setAnneeChoisie} comparaison={comparaison} /> : null}

        {/* Le détail des cartes de résultats s'ouvre par groupe. */}
        <FournisseurDesDetails>
        <main id={ANCRES.contenu} tabIndex={-1} className="min-w-0 flex-grow scroll-mt-20 focus:outline-none">
          {/* Affichage « Trois vues » : les acteurs et la grille, puis les résultats, puis le comparateur, chacun dans sa vue. */}
          <VueDeLaPage vue="situation">
            <EntitiesManager session={currentSession} setSession={setCurrentSession} annee={annee} onChargerMontage={chargerUnMontage} />

            <GrilleDeLAnnee session={currentSession} setSession={setCurrentSession} annee={annee} onAnnee={setAnneeChoisie} monthlyData={vue.monthlyData} preferences={userPreferences} flowTypeToNumberMap={flowTypeToNumberMap} />

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
