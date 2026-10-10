// src/backend/logic/messages-des-fichiers.test.ts

import { describe, expect, it } from "vitest"
import type { SanitizationReport } from "../../types.js"
import { AnneesRefuseesError } from "./data-sanitizer.js"
import { FILTRES_FICHIERS, nomDeLExport, notificationDeLImport, refusDeLImport } from "./messages-des-fichiers.js"

const rapportPropre: SanitizationReport = { entitiesRemoved: 0, relationshipsRemoved: 0, flowsRemoved: 0, reglagesRemoved: 0, professionsRemoved: 0, anneesEcartees: [], migrationNotes: [] }

describe("fenêtres de fichiers", () => {
  it("un filtre par format de fichier texte, avec son extension", () => {
    expect(FILTRES_FICHIERS.csv.extensions).toEqual(["csv"])
    expect(FILTRES_FICHIERS.markdown.extensions).toEqual(["md"])
    expect(FILTRES_FICHIERS.json.extensions).toEqual(["json"])
  })

  it("l'export JSON est horodaté", () => {
    expect(nomDeLExport(1_700_000_000_000)).toBe("simulateur-export-1700000000000.json")
  })
})

describe("notification après un import", () => {
  it("réussite simple quand rien n'a été corrigé", () => {
    expect(notificationDeLImport(rapportPropre)).toEqual({ message: "Simulation importée avec succès !", type: "success" })
  })

  it("avertissement dès qu'un élément a été corrigé ou que le fichier a été converti", () => {
    expect(notificationDeLImport({ ...rapportPropre, flowsRemoved: 1 }).type).toBe("warning")
    expect(notificationDeLImport({ ...rapportPropre, migrationNotes: ["Format converti."] })).toEqual({ message: "Fichier importé avec des ajustements : vérifiez le détail avant de continuer.", type: "warning" })
  })
})

describe("import refusé", () => {
  it("un fichier refusé à cause de ses années donne son motif seul", () => {
    expect(refusDeLImport(new AnneesRefuseesError("Année 1990 inconnue des règles."))).toEqual({ titre: "Import impossible", message: "Année 1990 inconnue des règles.", motif: "Année 1990 inconnue des règles." })
  })

  it("un autre refus dit que le fichier est invalide, avec le détail", () => {
    const refus = refusDeLImport(new SyntaxError("Unexpected token"))
    expect(refus.titre).toBe("Erreur d'importation")
    expect(refus.message).toBe("Le fichier sélectionné est invalide, corrompu ou d'une version non compatible.\n\nDétails : Unexpected token")
    expect(refus.motif).toBe("Unexpected token")
  })

  it("une erreur qui n'en est pas une a un motif générique", () => {
    expect(refusDeLImport("rien").motif).toBe("Erreur inconnue.")
  })
})
