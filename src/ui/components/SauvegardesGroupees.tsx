// src/ui/components/SauvegardesGroupees.tsx
// Export de toutes les sauvegardes dans un seul fichier, et import d'un tel fichier, depuis la liste des sauvegardes.
// Le format, la lecture et la fusion sont des fonctions pures (src/backend/logic/sauvegardes-groupees.ts) ;
// l'import n'écrase jamais une sauvegarde existante, et son bilan s'affiche dans une fenêtre.

import { useState } from "react"
import { toast } from "sonner"
import { FileDown, FileUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { construireFichierSauvegardes, fusionnerSauvegardes, lireFichierSauvegardes, nomFichierSauvegardes, type RapportFusion, type RapportLecture } from "@/backend/logic/sauvegardes-groupees"
import * as SessionService from "@/lib/session-service"
import type { SaveSlot } from "@/types"

interface SauvegardesGroupeesProps {
  allSaveSlots: SaveSlot[]
  slotOrder: string[]
  setAllSaveSlots: (slots: SaveSlot[]) => void
  setSlotOrder: (ordre: string[]) => void
}

/** Bilan affiché après une tentative d'import. */
type Bilan = { erreur: string } | { lecture: RapportLecture; fusion: RapportFusion }

/** Le panneau est étroit sur téléphone : l'étiquette passe à la ligne plutôt que de déborder du bouton. */
const ETIQUETTE_SUR_DEUX_LIGNES = "h-auto min-h-9 whitespace-normal py-2"

const pluriel = (n: number, singulier: string, plurielForme: string) => `${n} ${n > 1 ? plurielForme : singulier}`

/** Les lignes du bilan d'un import réussi ; seules les rubriques non vides sont affichées. */
function DetailImport({ lecture, fusion }: { lecture: RapportLecture; fusion: RapportFusion }) {
  if (lecture.lues === 0 && lecture.ecartees === 0 && lecture.refusees.length === 0) return <p>Ce fichier ne contient aucune sauvegarde.</p>

  return (
    <>
      <ul className="list-disc space-y-1 pl-5">
        <li>{fusion.ajoutees > 0 ? `${pluriel(fusion.ajoutees, "sauvegarde ajoutée", "sauvegardes ajoutées")} à la fin de la liste.` : "Aucune sauvegarde ajoutée."}</li>
        {fusion.doublons > 0 && <li>{pluriel(fusion.doublons, "sauvegarde déjà présente, ignorée.", "sauvegardes déjà présentes, ignorées.")}</li>}
        {lecture.ecartees > 0 && <li>{pluriel(lecture.ecartees, "sauvegarde illisible ou endommagée, écartée.", "sauvegardes illisibles ou endommagées, écartées.")}</li>}
      </ul>
      {lecture.refusees.length > 0 && (
        <>
          <p className="mt-3">{lecture.refusees.length > 1 ? "Ces sauvegardes n'ont pas été importées" : "Cette sauvegarde n'a pas été importée"} :</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {lecture.refusees.map(({ nom, raison }, i) => (
              <li key={i}>
                « {nom} » : {raison}
              </li>
            ))}
          </ul>
        </>
      )}
      {fusion.renommees.length > 0 && (
        <>
          <p className="mt-3">Pour ne rien écraser, {fusion.renommees.length > 1 ? "ces sauvegardes ont été renommées" : "cette sauvegarde a été renommée"} :</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {fusion.renommees.map(({ ancienNom, nouveauNom }, i) => (
              <li key={i}>
                « {ancienNom} » devient « {nouveauNom} »
              </li>
            ))}
          </ul>
        </>
      )}
      {lecture.notesMigration.length > 0 && (
        <>
          <p className="mt-3">Des sauvegardes ont été converties au nouveau format du simulateur. À l'ouverture de chacune, vérifiez :</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {lecture.notesMigration.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

export function SauvegardesGroupees({ allSaveSlots, slotOrder, setAllSaveSlots, setSlotOrder }: SauvegardesGroupeesProps) {
  const [bilan, setBilan] = useState<Bilan | null>(null)

  const exporter = async () => {
    const fichier = construireFichierSauvegardes(allSaveSlots, slotOrder)
    const enregistre = await window.api.saveTextFile({ defaultName: nomFichierSauvegardes(), content: JSON.stringify(fichier, null, 2), format: "json" })
    if (enregistre) toast.success(`${pluriel(fichier.slots.length, "sauvegarde exportée", "sauvegardes exportées")}.`)
  }

  const importer = async () => {
    const contenu = await window.api.openTextFile({ title: "Importer des sauvegardes", format: "json" })
    if (contenu === null) return

    const lecture = lireFichierSauvegardes(contenu)
    if (!lecture.ok) {
      setBilan({ erreur: lecture.erreur })
      return
    }

    const fusion = fusionnerSauvegardes(allSaveSlots, slotOrder, lecture.slots)
    if (fusion.rapport.ajoutees > 0) {
      setAllSaveSlots(fusion.slots)
      // Silencieux : le bilan de l'import tient lieu de confirmation.
      SessionService.saveAllSlots(fusion.slots, { silencieux: true })
      setSlotOrder(fusion.slotOrder)
    }
    setBilan({ lecture: lecture.rapport, fusion: fusion.rapport })
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button onClick={exporter} variant="outline" disabled={allSaveSlots.length === 0} className={ETIQUETTE_SUR_DEUX_LIGNES}>
          <FileDown className="mr-2 h-4 w-4" /> Exporter toutes les sauvegardes
        </Button>
        <Button onClick={importer} variant="outline" className={ETIQUETTE_SUR_DEUX_LIGNES}>
          <FileUp className="mr-2 h-4 w-4" /> Importer des sauvegardes...
        </Button>
      </div>

      <Dialog open={bilan !== null} onOpenChange={open => !open && setBilan(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{bilan && "erreur" in bilan ? "Import impossible" : "Import des sauvegardes"}</DialogTitle>
            <DialogDescription asChild>
              <div className="text-left text-sm">{bilan && ("erreur" in bilan ? <p>{bilan.erreur}</p> : <DetailImport lecture={bilan.lecture} fusion={bilan.fusion} />)}</div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setBilan(null)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
