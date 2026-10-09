// src/ui/components/NotificationProvider.test.tsx
// Les notifications du pont (process principal ou démo web) s'affichent : un échec d'enregistrement en erreur, jamais
// en réussite.

import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { NotificationPayload } from "@/types"
import { NotificationProvider } from "./NotificationProvider"

/** Affiche le fournisseur et rend la fonction qui simule une notification du pont. */
function afficher() {
  let notifier: (payload: NotificationPayload) => void = () => {}
  vi.mocked(window.api.onShowNotification).mockImplementation(callback => {
    notifier = callback
    return () => {}
  })
  render(<NotificationProvider />)
  return (payload: NotificationPayload) => act(() => notifier(payload))
}

describe("NotificationProvider", () => {
  it("affiche l'échec d'une sauvegarde comme une erreur, sans « Sauvegarde réussie ! »", async () => {
    const notifier = afficher()
    const message = "Échec de la sauvegarde : le fichier des sauvegardes n'a pas pu être écrit. Vos sauvegardes précédentes sont intactes."

    notifier({ message, type: "error" })

    const toast = await screen.findByText(message)
    expect(toast.closest("[data-sonner-toast]")).toHaveAttribute("data-type", "error")
    expect(screen.queryByText("Sauvegarde réussie !")).not.toBeInTheDocument()
  })

  it("affiche une réussite, un avertissement et une information", async () => {
    const notifier = afficher()
    notifier({ message: "Sauvegarde réussie !", type: "success" })
    notifier({ message: "Sauvegardes illisibles mises de côté.", type: "warning" })
    notifier({ message: "Pour information." })

    expect((await screen.findByText("Sauvegarde réussie !")).closest("[data-sonner-toast]")).toHaveAttribute("data-type", "success")
    expect((await screen.findByText("Sauvegardes illisibles mises de côté.")).closest("[data-sonner-toast]")).toHaveAttribute("data-type", "warning")
    expect((await screen.findByText("Pour information.")).closest("[data-sonner-toast]")).toHaveAttribute("data-type", "info")
  })
})
