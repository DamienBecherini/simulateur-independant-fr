// src/ui/components/SituationParLAdresse.tsx
// Dans la démo web, une adresse comme `#situation=couple-union-libre` ouvre la situation type correspondante (lien
// « Ouvrir cet exemple dans le simulateur » d'une page extérieure), à l'ouverture de la page ou en cours de route :
// - sur une simulation vide ou sur l'exemple du premier lancement, la situation se charge directement ;
// - sur une simulation non enregistrée, la même confirmation que la fenêtre des situations types la précède ; refusée,
//   rien ne change ;
// - un identifiant inconnu donne un message discret, avec l'accès à la fenêtre des situations types.
// Le chargement s'annule en une étape, comme depuis la fenêtre. Une fois l'adresse lue, son fragment est retiré : un
// rechargement ne remet pas la situation par-dessus le travail fait depuis. L'application de bureau n'a pas d'adresse
// à partager : sans `lienVersUneSituation` dans la plateforme, rien n'est lu.

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { identifiantDeLAdresse, situationDeLIdentifiant } from "@/lib/montages/adresse"
import type { MontageType } from "@/lib/montages/montages"
import type { SessionState } from "@/types"
import { usePlateforme } from "../plateforme"
import { ConfirmationDuMontage, FenetreDesMontages } from "./MontagesTypes"

interface SituationParLAdresseProps {
  session: SessionState
  /** Vrai une fois la session enregistrée chargée : l'adresse n'est lue qu'ensuite, sinon ce chargement la recouvrirait. */
  sessionChargee: boolean
  /** La simulation en cours serait perdue (même règle que la fenêtre des situations types). */
  confirmationNecessaire: boolean
  /** Charge la situation : un remplacement de la session, annulable en une étape. */
  onCharger: (montage: MontageType) => void
}

/** Remplace le fragment de l'adresse (sans nouvelle entrée dans l'historique) : `fragment` vide le retire. */
function remplacerLeFragment(fragment: string) {
  const { pathname, search } = window.location
  window.history.replaceState(window.history.state, "", `${pathname}${search}${fragment}`)
}

function MessageIntrouvable({ identifiant, onVoirLesSituations, onFermer, bouton }: { identifiant: string; onVoirLesSituations: () => void; onFermer: () => void; bouton: RefObject<HTMLButtonElement | null> }) {
  return (
    <div className="mb-6 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 print:hidden dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50">
      <p className="min-w-0 flex-1 py-1.5 break-words">
        Situation introuvable : le lien « #situation={identifiant} » ne correspond à aucune situation type, la simulation en cours n'a pas changé.{" "}
        <Button ref={bouton} variant="link" className="h-auto p-0 text-sm text-blue-800 underline underline-offset-2 dark:text-blue-300" onClick={onVoirLesSituations}>
          Voir les situations types
        </Button>
      </p>
      <Button variant="ghost" size="icon" className="shrink-0" aria-label="Fermer le message" onClick={onFermer}>
        <X />
      </Button>
    </div>
  )
}

export function SituationParLAdresse({ session, sessionChargee, confirmationNecessaire, onCharger }: SituationParLAdresseProps) {
  const { lienVersUneSituation, estLaSessionDExemple } = usePlateforme()
  const actif = lienVersUneSituation !== undefined
  const [aConfirmer, setAConfirmer] = useState<MontageType | null>(null)
  const [introuvable, setIntrouvable] = useState<string | null>(null)
  const [fenetreOuverte, setFenetreOuverte] = useState(false)
  // Aucun bouton n'a demandé la confirmation : le focus reste où il est à sa fermeture.
  const aucunDeclencheur = useRef<HTMLElement | null>(null)
  // Le lien du message : le focus y revient à la fermeture de la fenêtre des situations types.
  const boutonDuMessage = useRef<HTMLButtonElement | null>(null)

  const charger = (montage: MontageType) => {
    setAConfirmer(null)
    setIntrouvable(null)
    onCharger(montage)
  }

  // Lit l'adresse ; `fragmentPrecedent` est celui qui la remplacera (la vue affichée avant le lien, ou rien).
  const lireLAdresse = useEffectEvent((fragmentPrecedent: string) => {
    const identifiant = identifiantDeLAdresse(window.location.hash)
    if (identifiant === null) return
    remplacerLeFragment(fragmentPrecedent)
    const situation = situationDeLIdentifiant(identifiant)
    if (!situation) {
      setIntrouvable(identifiant)
      return
    }
    // L'exemple du premier lancement n'est le travail de personne : il se remplace sans question, comme une simulation vide.
    if (confirmationNecessaire && !(estLaSessionDExemple?.(session) ?? false)) {
      setIntrouvable(null)
      setAConfirmer(situation)
    } else charger(situation)
  })

  useEffect(() => {
    if (!actif || !sessionChargee) return
    // L'adresse est un système extérieur, lue une fois la session chargée en même temps que l'abonnement à ses changements.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation voulue avec l'adresse, voir ci-dessus
    lireLAdresse("")
    const suivre = (evenement: HashChangeEvent) => {
      const precedent = new URL(evenement.oldURL).hash
      lireLAdresse(identifiantDeLAdresse(precedent) === null ? precedent : "")
    }
    window.addEventListener("hashchange", suivre)
    return () => window.removeEventListener("hashchange", suivre)
  }, [actif, sessionChargee])

  if (!actif) return null
  return (
    <>
      {/* Région annoncée sans prendre le focus : le message ne bloque rien. */}
      <div role="status">
        {introuvable === null ? null : <MessageIntrouvable identifiant={introuvable} bouton={boutonDuMessage} onVoirLesSituations={() => setFenetreOuverte(true)} onFermer={() => setIntrouvable(null)} />}
      </div>
      <ConfirmationDuMontage montage={aConfirmer} nomDeLaSession={session.name} onAnnuler={() => setAConfirmer(null)} onConfirmer={charger} declencheur={aucunDeclencheur} />
      <FenetreDesMontages open={fenetreOuverte} onOpenChange={setFenetreOuverte} onCharger={charger} confirmationNecessaire={confirmationNecessaire} nomDeLaSession={session.name} declencheur={boutonDuMessage} />
    </>
  )
}
