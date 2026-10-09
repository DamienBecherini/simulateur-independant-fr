// src/ui/components/SettingsSheet.test.tsx
// Liste des sauvegardes : export de toutes les sauvegardes dans un fichier et import d'un tel fichier.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { FORMAT_VERSION_ACTUEL } from "@/backend/logic/migrations"
import { TYPE_FICHIER_SAUVEGARDES } from "@/backend/logic/sauvegardes-groupees"
import { VERSION_DE_L_APPLICATION } from "@/lib/version"
import type { SanitizationReport, SaveSlot } from "@/types"
import { emptySession, makePerson } from "@/ui/testing/fixtures"
import { SettingsSheet } from "./SettingsSheet"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() } }))

beforeEach(() => vi.mocked(toast.success).mockClear())

function sauvegarde(id: string, name: string): SaveSlot {
  return { ...emptySession(), id, name, entities: [makePerson({ id: `${id}-p`, name: `Personne de ${name}` })], lastModified: Date.UTC(2026, 8, 1) }
}

function fichier(slots: unknown[], slotOrder: string[] = []): string {
  return JSON.stringify({ formatVersion: FORMAT_VERSION_ACTUEL, type: TYPE_FICHIER_SAUVEGARDES, exportedAt: "2026-10-04T08:00:00.000Z", slots, slotOrder })
}

/** Le panneau avec un vrai état des sauvegardes, pour suivre la liste après un import. */
function PanneauDesSauvegardes({ initiales, ordreInitial, onChange }: { initiales: SaveSlot[]; ordreInitial: string[]; onChange: (slots: SaveSlot[], ordre: string[]) => void }) {
  const [slots, setSlots] = useState(initiales)
  const [ordre, setOrdre] = useState(ordreInitial)
  const [session, setSession] = useState(emptySession())
  onChange(slots, ordre)
  return (
    <SettingsSheet
      isOpen
      onOpenChange={() => {}}
      allSaveSlots={slots}
      setAllSaveSlots={setSlots}
      currentSession={session}
      setCurrentSession={setSession}
      slotOrder={ordre}
      setSlotOrder={setOrdre}
      onReset={() => {}}
      onLoadSlot={() => {}}
      onImport={async () => {}}
      onLoadMontage={() => {}}
      importConfirmation={null}
      onConfirmImport={() => {}}
      onCancelImport={() => {}}
      loadedSlotId={null}
      setLoadedSlotId={() => {}}
    />
  )
}

/** Ouvre la liste des sauvegardes ; renvoie l'état courant des sauvegardes et de leur ordre. */
async function ouvrirLaListe(initiales: SaveSlot[] = [], ordreInitial = initiales.map(slot => slot.id)) {
  const etat = { slots: initiales, ordre: ordreInitial }
  render(
    <PanneauDesSauvegardes
      initiales={initiales}
      ordreInitial={ordreInitial}
      onChange={(slots, ordre) => {
        etat.slots = slots
        etat.ordre = ordre
      }}
    />
  )
  await userEvent.click(screen.getByRole("button", { name: "Charger une sauvegarde..." }))
  return etat
}

const boutonExporter = () => screen.getByRole("button", { name: "Exporter toutes les sauvegardes" })
const boutonImporter = () => screen.getByRole("button", { name: "Importer des sauvegardes..." })

describe("SettingsSheet, export de toutes les sauvegardes", () => {
  it("est désactivé tant qu'il n'y a aucune sauvegarde", async () => {
    await ouvrirLaListe()

    expect(boutonExporter()).toBeDisabled()
    expect(boutonImporter()).toBeEnabled()
  })

  it("enregistre toutes les sauvegardes dans leur ordre d'affichage, dans un fichier daté", async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 4, 10, 0), toFake: ["Date"] })
    const [a, b] = [sauvegarde("a", "Alpha"), sauvegarde("b", "Bravo")]
    await ouvrirLaListe([a, b], ["b", "a"])

    await userEvent.click(boutonExporter())

    expect(window.api.saveTextFile).toHaveBeenCalledOnce()
    const { defaultName, content, format } = vi.mocked(window.api.saveTextFile).mock.calls[0][0]
    expect(defaultName).toBe("sauvegardes-simulateur-2026-10-04.json")
    expect(format).toBe("json")
    const contenu = JSON.parse(content)
    expect(contenu).toMatchObject({ formatVersion: FORMAT_VERSION_ACTUEL, appVersion: VERSION_DE_L_APPLICATION, type: TYPE_FICHIER_SAUVEGARDES, slotOrder: ["b", "a"] })
    expect(contenu.slots.map((slot: SaveSlot) => slot.name)).toEqual(["Bravo", "Alpha"])
    expect(toast.success).toHaveBeenCalledWith("2 sauvegardes exportées.")
    vi.useRealTimers()
  })

  it("ne confirme rien si l'utilisateur annule l'enregistrement", async () => {
    vi.mocked(window.api.saveTextFile).mockResolvedValue(false)
    await ouvrirLaListe([sauvegarde("a", "Alpha")])

    await userEvent.click(boutonExporter())

    expect(window.api.saveTextFile).toHaveBeenCalledOnce()
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe("SettingsSheet, import de sauvegardes", () => {
  it("ne fait rien si l'utilisateur annule le choix du fichier", async () => {
    const etat = await ouvrirLaListe([sauvegarde("a", "Alpha")])

    await userEvent.click(boutonImporter())

    expect(window.api.openTextFile).toHaveBeenCalledWith({ title: "Importer des sauvegardes", format: "json" })
    expect(screen.queryByRole("dialog", { name: /Import/ })).not.toBeInTheDocument()
    expect(window.api.saveSlots).not.toHaveBeenCalled()
    expect(etat.slots).toHaveLength(1)
  })

  it("ajoute les sauvegardes du fichier après les existantes, les enregistre et affiche le bilan", async () => {
    const [a, b, c] = [sauvegarde("a", "Alpha"), sauvegarde("b", "Bravo"), sauvegarde("c", "Charlie")]
    vi.mocked(window.api.openTextFile).mockResolvedValue(fichier([c, b], ["c", "b"]))
    const etat = await ouvrirLaListe([a])

    await userEvent.click(boutonImporter())

    const bilan = await screen.findByRole("dialog", { name: "Import des sauvegardes" })
    expect(bilan).toHaveTextContent("2 sauvegardes ajoutées à la fin de la liste.")
    expect(etat.slots.map(slot => slot.name)).toEqual(["Alpha", "Charlie", "Bravo"])
    expect(etat.ordre).toEqual(["a", "c", "b"])
    expect(window.api.saveSlots).toHaveBeenCalledWith(etat.slots, { silencieux: true })

    await userEvent.click(within(bilan).getByRole("button", { name: "OK" }))
    expect(screen.queryByRole("dialog", { name: "Import des sauvegardes" })).not.toBeInTheDocument()
    const liste = screen.getAllByRole("button", { name: /^Charger la sauvegarde/ }).map(bouton => bouton.getAttribute("aria-label"))
    expect(liste).toEqual(["Charger la sauvegarde « Alpha »", "Charger la sauvegarde « Charlie »", "Charger la sauvegarde « Bravo »"])
  })

  it("détaille les doublons ignorés, les copies renommées, les sauvegardes écartées et les points à vérifier", async () => {
    const [a, b] = [sauvegarde("a", "Alpha"), sauvegarde("b", "Bravo")]
    const homonyme = sauvegarde("autre", "Bravo")
    const ancienne = { ...sauvegarde("vieille", "Vieille"), relationships: [{ id: "r1", fromId: "vieille-p", toId: "vieille-p", type: "Enfant" }], formatVersion: 1 }
    vi.mocked(window.api.openTextFile).mockResolvedValue(fichier([a, homonyme, { id: "cassee" }, ancienne]))
    const etat = await ouvrirLaListe([a, b])

    await userEvent.click(boutonImporter())

    const bilan = await screen.findByRole("dialog", { name: "Import des sauvegardes" })
    expect(bilan).toHaveTextContent("2 sauvegardes ajoutées")
    expect(bilan).toHaveTextContent("1 sauvegarde déjà présente, ignorée.")
    expect(bilan).toHaveTextContent("1 sauvegarde illisible ou endommagée, écartée.")
    expect(bilan).toHaveTextContent("cette sauvegarde a été renommée")
    expect(bilan).toHaveTextContent("« Bravo » devient « Bravo (importée) »")
    expect(bilan).toHaveTextContent("relation « Enfant »")
    expect(etat.slots.map(slot => slot.name)).toEqual(["Alpha", "Bravo", "Bravo (importée)", "Vieille"])
  })

  it("n'enregistre rien quand toutes les sauvegardes du fichier sont déjà présentes", async () => {
    const a = sauvegarde("a", "Alpha")
    vi.mocked(window.api.openTextFile).mockResolvedValue(fichier([a]))
    await ouvrirLaListe([a])

    await userEvent.click(boutonImporter())

    const bilan = await screen.findByRole("dialog", { name: "Import des sauvegardes" })
    expect(bilan).toHaveTextContent("Aucune sauvegarde ajoutée.")
    expect(bilan).toHaveTextContent("1 sauvegarde déjà présente, ignorée.")
    expect(window.api.saveSlots).not.toHaveBeenCalled()
  })

  it("nomme les sauvegardes refusées à cause de leurs années, avec le motif, et importe les autres", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const a = sauvegarde("a", "Alpha")
    const trouee = { ...sauvegarde("t", "Trouée"), annees: [2024, 2026].map(annee => ({ annee, monthlyData: emptySession().annees[0].monthlyData })) }
    vi.mocked(window.api.openTextFile).mockResolvedValue(fichier([a, trouee]))
    const etat = await ouvrirLaListe()

    await userEvent.click(boutonImporter())

    const bilan = await screen.findByRole("dialog", { name: "Import des sauvegardes" })
    expect(bilan).toHaveTextContent("1 sauvegarde ajoutée")
    expect(bilan).toHaveTextContent("Cette sauvegarde n'a pas été importée :")
    expect(bilan).toHaveTextContent("« Trouée » : Les années de cette simulation ne se suivent pas : il manque 2025 entre 2024 et 2026.")
    expect(etat.slots.map(slot => slot.name)).toEqual(["Alpha"])
  })

  it("signale un fichier sans aucune sauvegarde", async () => {
    vi.mocked(window.api.openTextFile).mockResolvedValue(fichier([]))
    await ouvrirLaListe()

    await userEvent.click(boutonImporter())

    expect(await screen.findByRole("dialog", { name: "Import des sauvegardes" })).toHaveTextContent("Ce fichier ne contient aucune sauvegarde.")
  })

  it("refuse l'export d'une simulation seule et renvoie vers l'import d'une simulation", async () => {
    vi.mocked(window.api.openTextFile).mockResolvedValue(JSON.stringify({ ...emptySession(), formatVersion: FORMAT_VERSION_ACTUEL }))
    const etat = await ouvrirLaListe([sauvegarde("a", "Alpha")])

    await userEvent.click(boutonImporter())

    const bilan = await screen.findByRole("dialog", { name: "Import impossible" })
    expect(bilan).toHaveTextContent("Ce fichier contient une seule simulation")
    expect(bilan).toHaveTextContent("« Importer une simulation... »")
    expect(window.api.saveSlots).not.toHaveBeenCalled()
    expect(etat.slots).toHaveLength(1)
  })
})

describe("confirmation d'un import ajusté", () => {
  const rapport: SanitizationReport = { entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0, reglagesRemoved: 0, professionsRemoved: 0, anneesEcartees: [], migrationNotes: ["À vérifier"] }

  function confirmer(appVersion?: string, report: SanitizationReport = rapport) {
    const session = appVersion === undefined ? emptySession() : { ...emptySession(), appVersion }
    const props = { isOpen: false, onOpenChange: () => {}, allSaveSlots: [], setAllSaveSlots: () => {}, currentSession: emptySession(), setCurrentSession: () => {}, slotOrder: [], setSlotOrder: () => {}, onReset: () => {}, onLoadSlot: () => {}, onImport: async () => {}, onLoadMontage: () => {}, onConfirmImport: () => {}, onCancelImport: () => {}, loadedSlotId: null, setLoadedSlotId: () => {} }
    render(<SettingsSheet {...props} importConfirmation={{ session, report }} />)
    return screen.getByRole("dialog", { name: "Fichier importé avec des ajustements" })
  }

  it("signale une profession inconnue écartée, sans parler de données corrompues", () => {
    const dialogue = confirmer(undefined, { ...rapport, migrationNotes: [], professionsRemoved: 1 })
    expect(dialogue).toHaveTextContent("Profession inconnue écartée : l'activité est calculée comme une profession libérale non réglementée.")
    expect(dialogue).not.toHaveTextContent("Entités invalides supprimées")
  })

  it("indique la version de l'application qui a écrit le fichier", () => {
    expect(confirmer("0.8.0")).toHaveTextContent("Fichier écrit par la version 0.8.0 du simulateur.")
  })

  it("ne dit rien de la version quand le fichier ne l'indique pas", () => {
    expect(confirmer()).not.toHaveTextContent("Fichier écrit par")
  })
})

describe("échec de l'enregistrement des sauvegardes", () => {
  /** Le panneau ouvert, sur une session nommée ; renvoie les fonctions de rappel observées. */
  function panneau(slots: SaveSlot[] = [], loadedSlotId: string | null = null) {
    const rappels = { onOpenChange: vi.fn(), setAllSaveSlots: vi.fn(), setSlotOrder: vi.fn(), setLoadedSlotId: vi.fn() }
    const session = { ...emptySession(), name: "Mon scénario" }
    render(<SettingsSheet isOpen allSaveSlots={slots} currentSession={session} setCurrentSession={() => {}} slotOrder={slots.map(slot => slot.id)} onReset={() => {}} onLoadSlot={() => {}} onImport={async () => {}} onLoadMontage={() => {}} importConfirmation={null} onConfirmImport={() => {}} onCancelImport={() => {}} loadedSlotId={loadedSlotId} {...rappels} />)
    return rappels
  }

  it("une sauvegarde écrite ferme le panneau et rejoint la liste", async () => {
    const rappels = panneau()
    await userEvent.click(screen.getByRole("button", { name: "Sauvegarder" }))
    expect(rappels.setAllSaveSlots).toHaveBeenCalledWith([expect.objectContaining({ name: "Mon scénario" })])
    expect(rappels.setLoadedSlotId).toHaveBeenCalledOnce()
    expect(rappels.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("si l'écriture échoue, le panneau reste ouvert et rien ne change : l'utilisateur peut réessayer", async () => {
    vi.mocked(window.api.saveSlots).mockResolvedValue(false)
    const rappels = panneau()

    await userEvent.click(screen.getByRole("button", { name: "Sauvegarder" }))

    expect(window.api.saveSlots).toHaveBeenCalledOnce()
    expect(rappels.setAllSaveSlots).not.toHaveBeenCalled()
    expect(rappels.setLoadedSlotId).not.toHaveBeenCalled()
    expect(rappels.onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog", { name: "Configuration" })).toBeInTheDocument()
  })

  it("la mise à jour de la sauvegarde chargée ne change rien si l'écriture échoue", async () => {
    vi.mocked(window.api.saveSlots).mockResolvedValue(false)
    const rappels = panneau([sauvegarde("a", "Mon scénario")], "a")
    await userEvent.click(screen.getByRole("button", { name: "Sauvegarder" }))
    expect(window.api.saveSlots).toHaveBeenCalledWith([expect.objectContaining({ id: "a" })], undefined)
    expect(rappels.setAllSaveSlots).not.toHaveBeenCalled()
    expect(rappels.onOpenChange).not.toHaveBeenCalled()
  })

  it("l'écrasement et la suppression ne changent rien si l'écriture échoue", async () => {
    vi.mocked(window.api.saveSlots).mockResolvedValue(false)
    const rappels = panneau([sauvegarde("a", "Mon scénario")])
    await userEvent.click(screen.getByRole("button", { name: "Sauvegarder" }))
    await userEvent.click(await screen.findByRole("button", { name: "Écraser" }))
    expect(window.api.saveSlots).toHaveBeenCalledOnce()
    expect(rappels.setAllSaveSlots).not.toHaveBeenCalled()
    expect(rappels.setLoadedSlotId).not.toHaveBeenCalled()
    expect(rappels.onOpenChange).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "Charger une sauvegarde..." }))
    await userEvent.click(screen.getByRole("button", { name: "Supprimer la sauvegarde « Mon scénario »" }))
    expect(window.api.saveSlots).toHaveBeenLastCalledWith([], undefined)
    expect(rappels.setAllSaveSlots).not.toHaveBeenCalled()
    expect(rappels.setSlotOrder).not.toHaveBeenCalled()
  })

  it("un import de sauvegardes qui ne peut pas être écrit n'ajoute rien et n'affiche pas de bilan", async () => {
    vi.mocked(window.api.saveSlots).mockResolvedValue(false)
    vi.mocked(window.api.openTextFile).mockResolvedValue(fichier([sauvegarde("b", "Bravo")]))
    const etat = await ouvrirLaListe([sauvegarde("a", "Alpha")])

    await userEvent.click(boutonImporter())

    expect(window.api.saveSlots).toHaveBeenCalledOnce()
    expect(etat.slots.map(slot => slot.name)).toEqual(["Alpha"])
    expect(screen.queryByRole("dialog", { name: "Import des sauvegardes" })).not.toBeInTheDocument()
  })
})
