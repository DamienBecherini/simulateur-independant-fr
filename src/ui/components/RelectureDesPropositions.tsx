// src/ui/components/RelectureDesPropositions.tsx
// Fenêtre « Proposition de votre IA » (voir l'ADR 011) : une proposition déposée par le serveur MCP local s'affiche
// avec son récapitulatif, une ligne par opération, les doublons probables et l'effet sur le net de chaque année,
// recalculés sur la simulation affichée. « Appliquer » la fait entrer en une seule étape d'annulation ; « Refuser » la
// retire. Une proposition périmée (la simulation a changé depuis) ne peut que se retirer. « Plus tard » la garde.
// Une case de la fenêtre (ou des paramètres) laisse l'IA modifier directement la simulation (ADR 011, addendum du
// 2026-10-14) : ses propositions suivantes, relues de la même façon, s'appliquent dès leur arrivée si elles sont valides
// et à jour, avec une notification qui permet de les annuler. Restent ici : celles qui suppriment quelque chose, celles
// qui attendaient déjà, et celles qui ne s'appliquent pas (périmées, refusées), sans bloquer les suivantes.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Bot } from "lucide-react"
import { toast } from "sonner"
import type { SessionState } from "@/types"
import type { PropositionRecue } from "@/backend/mcp/proposition-en-attente"
import { supprimeQuelqueChose } from "@/backend/logic/outils/propositions"
import { euros } from "@/backend/logic/format"
import { cn } from "@/lib/utils"
import { ligneAlternee } from "../lignes-alternees"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { relireLaProposition, type ApercuDUneAnnee, type Relecture } from "@/lib/relecture-de-proposition"
import { CaseDeModificationDirecte } from "./IndicateurDeModificationDirecte"

interface RelectureDesPropositionsProps {
  session: SessionState
  propositions: PropositionRecue[]
  /** Remplace la session par celle obtenue : une seule étape d'annulation. */
  onAppliquer: (nouvelleSession: SessionState) => void
  /** Retire une proposition traitée de la boîte. */
  onRetirer: (id: string) => void
  /** Vrai si l'IA modifie directement la simulation : une proposition valide et à jour s'applique dès son arrivée. */
  iaModifieDirectement: boolean
  /** Les propositions arrivées pendant que l'IA modifie directement la simulation : les seules qui peuvent s'appliquer seules. */
  arriveesEnDirect: ReadonlySet<string>
  /** Des propositions arrivées en direct qui ne s'appliquent pas : elles passent en relecture. */
  onGarderEnRelecture: (ids: readonly string[]) => void
  /** Laisse l'IA modifier directement la simulation (case cochée, puis « Appliquer »). */
  onLaisserLIAModifier: () => void
  /** Défait la dernière étape de l'historique (« Annuler » de la notification d'une proposition appliquée seule). */
  onAnnuler: () => void
}

const PETIT_TEXTE = "text-sm text-slate-600 dark:text-slate-400"

const montant = (valeur: number | null) => (valeur === null ? "—" : euros(valeur))
const ecart = (valeur: number | null) => (valeur === null ? "—" : `${valeur > 0 ? "+" : ""}${euros(valeur)}`)

function TableauDeLApercu({ apercu }: { apercu: ApercuDUneAnnee[] }) {
  return (
    <table className="w-full text-sm">
      <caption className="mb-1 text-left font-semibold text-slate-800 dark:text-slate-100">Net après impôts des foyers, calculé par le simulateur</caption>
      <thead>
        <tr className="border-b text-left">
          <th scope="col" className="py-1 pr-2 font-medium">Année</th>
          <th scope="col" className="py-1 pr-2 text-right font-medium">Avant</th>
          <th scope="col" className="py-1 pr-2 text-right font-medium">Après</th>
          <th scope="col" className="py-1 text-right font-medium">Écart</th>
        </tr>
      </thead>
      <tbody>
        {apercu.map((ligne, rang) => (
          <tr key={ligne.annee} className={cn("border-b last:border-0", ligneAlternee(rang))}>
            <th scope="row" className="py-1 pr-2 text-left font-normal">{ligne.annee}</th>
            <td className="py-1 pr-2 text-right tabular-nums">{montant(ligne.netAvant)}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{montant(ligne.netApres)}</td>
            <td className="py-1 text-right tabular-nums">{ecart(ligne.ecart)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Le contenu de la fenêtre selon l'état de la proposition ; `children` suit le détail d'une proposition applicable. */
function DetailDeLaRelecture({ relecture, children }: { relecture: Relecture; children: ReactNode }) {
  if (relecture.etat === "perimee") {
    return (
      <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        <strong>Proposition périmée.</strong> Elle a été préparée sur une version précédente de la simulation ({relecture.nombreDOperations} opération{relecture.nombreDOperations > 1 ? "s" : ""}), que vous avez modifiée depuis : elle ne peut plus être appliquée. Demandez à l'IA de relire la simulation et de refaire sa proposition.
      </p>
    )
  }
  if (relecture.etat === "refusee") {
    return (
      <p role="alert" className="whitespace-pre-line rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100">
        <strong>Proposition refusée par le simulateur.</strong> {relecture.erreur}
      </p>
    )
  }
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Ce qui change</h3>
        <ul className="max-h-56 list-disc space-y-1 overflow-y-auto pl-5 text-sm">
          {relecture.resume.map((ligne, i) => (
            <li key={i}>{ligne}</li>
          ))}
        </ul>
      </div>
      {relecture.avertissements.length > 0 ? (
        <div role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-semibold">À vérifier</p>
          <ul className="list-disc pl-5">
            {relecture.avertissements.map((avertissement, i) => (
              <li key={i}>{avertissement}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <TableauDeLApercu apercu={relecture.apercu} />
      <p className={PETIT_TEXTE}>Vérifiez avant d'appliquer : l'IA a pu mal lire un document. « Annuler », dans la barre d'outils, défait l'application en une étape. Ce simulateur n'est pas l'avis d'un expert-comptable.</p>
      {children}
    </div>
  )
}

/** Sous la case de la fenêtre : ce qu'implique son activation. */
const AIDE_DE_LA_CASE = "Case cochée, « Appliquer » applique cette proposition, puis les suivantes de l'IA s'appliqueront aussitôt, chacune annulable (Ctrl+Z ou « Annuler »). Les suppressions, et les propositions qui attendent déjà, resteront à valider ici. Choix retenu d'une ouverture à l'autre : décochez la pastille « IA en direct » ou la case des paramètres pour y mettre fin."

/** À la place de la case, quand l'IA modifie déjà directement la simulation : pourquoi cette proposition attend. */
function NoteDeModificationDirecte({ suppression }: { suppression: boolean }) {
  return (
    <p role="note" className="rounded-md border border-violet-300 bg-violet-50 p-3 text-sm text-slate-800 dark:border-violet-700 dark:bg-violet-950 dark:text-slate-100">
      {suppression ? "L'IA modifie directement la simulation, mais une suppression attend toujours votre validation." : "L'IA modifie directement la simulation, mais cette proposition attendait déjà : elle reste à valider ici."}
    </p>
  )
}

/** « Ajouter 1 acteur », sans le point d'interrogation du récapitulatif. */
const sansQuestion = (recapitulatif: string) => recapitulatif.replace(/ \?$/, "")

/** La notification d'une proposition appliquée depuis la fenêtre, case « Laisser l'IA modifier… » cochée ou non. */
function messageDApplication(recapitulatif: string, iaModifieraDirectement: boolean): string {
  const suite = iaModifieraDirectement ? " L'IA modifiera désormais directement la simulation." : ""
  return `Proposition appliquée : ${sansQuestion(recapitulatif)}. « Annuler » la défait.${suite}`
}

type Rappels = Pick<RelectureDesPropositionsProps, "onAppliquer" | "onRetirer" | "onAnnuler" | "onGarderEnRelecture">

/**
 * Modification directe par l'IA : une proposition arrivée pendant que l'utilisateur la permet, et qui ne supprime rien,
 * n'ouvre pas la fenêtre ; elle est appliquée si elle est valide et à jour. Une à la fois, dans l'ordre d'arrivée : la
 * session obtenue devient la session affichée, sur laquelle la suivante est relue au rendu d'après. Celle qui ne
 * s'applique pas (périmée, refusée) passe en relecture pour de bon, sans retenir les suivantes : un retour en arrière
 * (Ctrl+Z) qui la rendrait applicable ne l'applique donc pas. Chaque proposition n'est appliquée qu'une fois, même si
 * l'effet est rejoué. Rend les propositions à montrer dans la fenêtre, dans l'ordre d'arrivée.
 */
function useModificationDirecte(
  { session, propositions, iaModifieDirectement, arriveesEnDirect }: Pick<RelectureDesPropositionsProps, "session" | "propositions" | "iaModifieDirectement" | "arriveesEnDirect">,
  { onAppliquer, onRetirer, onAnnuler, onGarderEnRelecture }: Rappels
): PropositionRecue[] {
  const { aAppliquer, inapplicables, aRelire } = useMemo(() => {
    const directe = (p: PropositionRecue) => iaModifieDirectement && arriveesEnDirect.has(p.id) && !supprimeQuelqueChose(p.proposition)
    const ecartees: string[] = []
    let trouvee: { proposition: PropositionRecue; relecture: Extract<Relecture, { etat: "applicable" }> } | null = null
    for (const proposition of propositions.filter(directe)) {
      const relecture = relireLaProposition(session, proposition)
      if (relecture.etat === "applicable") {
        trouvee = { proposition, relecture }
        break
      }
      ecartees.push(proposition.id)
    }
    return { aAppliquer: trouvee, inapplicables: ecartees, aRelire: propositions.filter(p => !directe(p) || ecartees.includes(p.id)) }
  }, [session, propositions, iaModifieDirectement, arriveesEnDirect])

  // La session affichée, pour le bouton « Annuler » d'une notification : il ne défait la proposition que si rien ne
  // l'a suivie dans l'historique.
  const sessionAffichee = useRef(session)
  useEffect(() => {
    sessionAffichee.current = session
  }, [session])

  const dejaAppliquees = useRef(new Set<string>())
  useEffect(() => {
    if (inapplicables.length > 0) onGarderEnRelecture(inapplicables)
    if (!aAppliquer || dejaAppliquees.current.has(aAppliquer.proposition.id)) return
    const { proposition, relecture } = aAppliquer
    dejaAppliquees.current.add(proposition.id)
    const { nouvelleSession, recapitulatif } = relecture
    onAppliquer(nouvelleSession)
    onRetirer(proposition.id)
    const annuler = () => {
      if (sessionAffichee.current === nouvelleSession) onAnnuler()
      else toast.info("La simulation a changé depuis : utilisez « Annuler » dans la barre d'outils, étape par étape.")
    }
    toast.success(`Modifié par l'IA : ${sansQuestion(recapitulatif)}`, { action: { label: "Annuler", onClick: annuler }, duration: 10_000 })
  }, [aAppliquer, inapplicables, onAppliquer, onRetirer, onAnnuler, onGarderEnRelecture])
  return aRelire
}

export function RelectureDesPropositions({ session, propositions, onAppliquer, onRetirer, iaModifieDirectement, arriveesEnDirect, onGarderEnRelecture, onLaisserLIAModifier, onAnnuler }: RelectureDesPropositionsProps) {
  const aRelire = useModificationDirecte({ session, propositions, iaModifieDirectement, arriveesEnDirect }, { onAppliquer, onRetirer, onAnnuler, onGarderEnRelecture })
  // Propositions remises à plus tard : elles restent dans la boîte et reviendront au prochain démarrage.
  const [remises, setRemises] = useState<ReadonlySet<string>>(new Set())
  const aMontrer = aRelire.filter(p => !remises.has(p.id))
  const proposition = aMontrer[0] ?? null
  // Recalculée à chaque changement de la simulation : une modification faite pendant la relecture la rend périmée.
  const relecture = useMemo(() => (proposition ? relireLaProposition(session, proposition) : null), [session, proposition])

  // La case « Laisser l'IA modifier directement… », cochée pour une proposition donnée : décochée pour la suivante.
  const [cocheePour, setCocheePour] = useState<string | null>(null)

  const remettre = () => proposition && setRemises(ids => new Set([...ids, proposition.id]))
  const appliquer = () => {
    if (!proposition || relecture?.etat !== "applicable") return
    const activer = cocheePour === proposition.id
    onAppliquer(relecture.nouvelleSession)
    onRetirer(proposition.id)
    if (activer) onLaisserLIAModifier()
    toast.success(messageDApplication(relecture.recapitulatif, activer))
  }

  return (
    <Dialog open={proposition !== null && relecture !== null} onOpenChange={ouverte => (ouverte ? undefined : remettre())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {proposition && relecture ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bot aria-hidden="true" className="size-5" /> Proposition de votre IA
              </DialogTitle>
              <DialogDescription>
                {relecture.etat === "applicable" ? relecture.recapitulatif : "Cette proposition ne peut pas être appliquée."}{" "}
                <span className="block">
                  Reçue le {new Date(proposition.creeeLe).toLocaleString("fr-FR")}
                  {aMontrer.length > 1 ? ` · 1 sur ${aMontrer.length} en attente` : ""}
                </span>
              </DialogDescription>
            </DialogHeader>
            <DetailDeLaRelecture relecture={relecture}>
              {iaModifieDirectement ? <NoteDeModificationDirecte suppression={supprimeQuelqueChose(proposition.proposition)} /> : <CaseDeModificationDirecte cochee={cocheePour === proposition.id} onChange={cochee => setCocheePour(cochee ? proposition.id : null)} aide={AIDE_DE_LA_CASE} />}
            </DetailDeLaRelecture>
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={remettre}>
                Plus tard
              </Button>
              <Button variant="outline" onClick={() => onRetirer(proposition.id)}>
                {relecture.etat === "applicable" ? "Refuser" : "Retirer"}
              </Button>
              {relecture.etat === "applicable" ? (
                <Button onClick={appliquer} className="min-w-28">
                  Appliquer
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
