// src/ui/zod-sans-eval.ts
// À importer avant tout module qui définit un schéma zod (premier import de demarrage.tsx).
//
// Pour valider plus vite, zod compile ses schémas d'objet avec `new Function`, après avoir essayé d'en créer une.
// La page l'interdit (Content-Security-Policy : script-src 'self', voir index.html) : l'essai échoue, zod s'en passe,
// mais le navigateur a relevé la tentative. Firefox l'écrit en erreur dans sa console, à chaque ouverture de la page.
// `jitless` dit à zod de ne pas essayer. Le choix se lit à la création de chaque schéma : d'où l'import en premier.

import { z } from "zod"

z.config({ jitless: true })
