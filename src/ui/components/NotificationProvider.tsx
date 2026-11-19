// src/ui/components/NotificationProvider.tsx
import { useEffect } from "react"
import { Toaster, toast } from "sonner"

export function NotificationProvider() {
  useEffect(() => {
    const cleanup = window.api.onShowNotification(payload => {
      const { message, type = "info" } = payload

      switch (type) {
        case "success":
          toast.success(message)
          break
        case "error":
          toast.error(message)
          break
        case "warning":
          toast.warning(message)
          break
        default:
          toast.info(message)
      }
    })

    // On retourne cette fonction de nettoyage.
    // React l'appellera automatiquement au démontage.
    return cleanup
  }, [])

  // Une croix sur chaque notification : on n'attend pas qu'une notification brève s'efface pour voir celles du
  // dessous. Les notifications dessinées par l'application (toast.custom) n'en ont pas.
  return <Toaster position="top-right" richColors closeButton toastOptions={{ closeButtonAriaLabel: "Fermer la notification" }} />
}
