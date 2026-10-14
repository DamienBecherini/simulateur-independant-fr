// src/web/plateforme-web.ts
// La démo web vue de l'interface (voir src/ui/plateforme.ts) : son bandeau, son bouton d'installation, le renvoi
// vers l'application de bureau dans la fenêtre « Utiliser avec une IA (MCP) », sa simulation d'exemple, et les liens
// vers ses situations types (#situation=…).

import { lienVersLaSituation } from "@/lib/montages/adresse"
import type { Plateforme } from "@/ui/plateforme"
import { BoutonInstaller } from "./AideALInstallation"
import { BandeauDemo } from "./BandeauDemo"
import { SeulementDansLApplicationDeBureau } from "./FenetreIADeLaDemo"
import { demoInstallee } from "./pwa/installation"
import { estLaSessionDExemple } from "./session-exemple"

export const PLATEFORME_WEB: Plateforme = {
  web: true,
  installee: () => demoInstallee(),
  Bandeau: BandeauDemo,
  BoutonInstaller,
  RenvoiVersLApplicationDeBureau: SeulementDansLApplicationDeBureau,
  estLaSessionDExemple,
  // L'adresse de la page plutôt qu'une adresse écrite en dur : le lien vaut aussi pour une copie locale de la démo.
  lienVersUneSituation: identifiant => lienVersLaSituation(window.location.href, identifiant)
}
