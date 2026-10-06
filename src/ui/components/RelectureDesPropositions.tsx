// src/ui/components/RelectureDesPropositions.tsx
// Fenêtre « Proposition de votre IA » (voir l'ADR 011) : une proposition déposée par le serveur MCP local s'affiche
// avec son récapitulatif, une ligne par opération, les doublons probables et l'effet sur le net de chaque année,
// recalculés sur la simulation affichée. « Appliquer » la fait entrer en une seule étape d'annulation ; « Refuser » la
// retire. Une proposition périmée (la simulation a changé depuis) ne peut que se retirer. « Plus tard » la garde.

import { useMemo, useState } from "react"
import { Bot } from "lucide-react"
import { toast } from "sonner"
import type { SessionState } from "@/types"
import type { PropositionRecue } from "@/backend/mcp/proposition-en-attente"
import { euros } from "@/backend/logic/format"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { relireLaProposition, type ApercuDUneAnnee, type Relecture } from "@/lib/relecture-de-proposition"

interface RelectureDesPropositionsProps {
  session: SessionState
  propositions: PropositionRecue[]
  /** Remplace la session par celle obtenue : une seule étape d'annulation. */
  onAppliquer: (nouvelleSession: SessionState) => void
  /** Retire une proposition traitée de la boîte. */
  onRetirer: (id: string) => void
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
        {apercu.map(ligne => (
          <tr key={ligne.annee} className="border-b last:border-0">
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

/** Le contenu de la fenêtre selon l'état de la proposition. */
function DetailDeLaRelecture({ relecture }: { relecture: Relecture }) {
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
    </div>
  )
}

export function RelectureDesPropositions({ session, propositions, onAppliquer, onRetirer }: RelectureDesPropositionsProps) {
  // Propositions remises à plus tard : elles restent dans la boîte et reviendront au prochain démarrage.
  const [remises, setRemises] = useState<ReadonlySet<string>>(new Set())
  const aMontrer = propositions.filter(p => !remises.has(p.id))
  const proposition = aMontrer[0] ?? null
  // Recalculée à chaque changement de la simulation : une modification faite pendant la relecture la rend périmée.
  const relecture = useMemo(() => (proposition ? relireLaProposition(session, proposition) : null), [session, proposition])

  const remettre = () => proposition && setRemises(ids => new Set([...ids, proposition.id]))
  const appliquer = () => {
    if (!proposition || relecture?.etat !== "applicable") return
    onAppliquer(relecture.nouvelleSession)
    onRetirer(proposition.id)
    toast.success(`Proposition appliquée : ${relecture.recapitulatif.replace(/ \?$/, "")}. « Annuler » la défait.`)
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
            <DetailDeLaRelecture relecture={relecture} />
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
