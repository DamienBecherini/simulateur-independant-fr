// src/ui/main.tsx
// Racine de composition de l'application de bureau : window.api vient du preload d'Electron (src/backend/preload.cts).
// La démo web a la sienne, src/web/main.tsx, que vite.config.ts met à la place de celle-ci dans index.html.

import { afficherLInterface } from "./demarrage"
import { PLATEFORME_DE_BUREAU } from "./plateforme"

afficherLInterface(PLATEFORME_DE_BUREAU)
