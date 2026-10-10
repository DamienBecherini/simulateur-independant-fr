// src/backend/logic/statuts.test.ts

import { describe, expect, it } from "vitest"
import { estSocieteIS, estStatutJuridique, IMPOSITION_DES_STATUTS, STATUTS_COMPARES, STATUTS_JURIDIQUES, STATUTS_SOCIETE, type StatutJuridique, type StatutSociete } from "../../types.js"
import { DIRIGEANT_DES_STATUTS, LIBELLES_DES_STATUTS, REGIME_DU_DIRIGEANT, RELATIONS_PAR_STATUT, STATUTS_A_PROFESSION } from "./statuts.js"

describe("statuts juridiques", () => {
  it("chaque table de statuts a une ligne par statut de STATUTS_JURIDIQUES, sans cas par défaut", () => {
    const tables = [IMPOSITION_DES_STATUTS, LIBELLES_DES_STATUTS, DIRIGEANT_DES_STATUTS, RELATIONS_PAR_STATUT, REGIME_DU_DIRIGEANT]
    for (const table of tables) expect(Object.keys(table).sort()).toEqual([...STATUTS_JURIDIQUES].sort())
  })

  it("les sociétés à l'IS se déduisent de l'imposition de chaque statut", () => {
    expect(STATUTS_SOCIETE).toEqual(["SASU", "EURL"])
    expect(STATUTS_COMPARES.filter(estSocieteIS)).toEqual(["SASU", "EURL"])
    expect(estSocieteIS("micro")).toBe(false)
  })

  it("seul un statut de la liste est un statut juridique, la micro-entreprise n'en est pas un", () => {
    expect(STATUTS_COMPARES.filter(estStatutJuridique)).toEqual(["SASU", "EURL", "EI"])
    expect(estStatutJuridique("toString")).toBe(false)
  })

  it("la profession se propose aux statuts dont le dirigeant est non salarié", () => {
    expect(STATUTS_A_PROFESSION).toEqual(["EURL", "EI"])
  })

  it("un statut ajouté à la liste sans ses lignes est refusé à la compilation (vérifié par tsc)", () => {
    // Si « SARL » rejoignait STATUTS_JURIDIQUES, les tables typées par statut n'auraient pas sa ligne : les lignes
    // suivantes, qui le simulent, ne compilent pas (sinon @ts-expect-error ferait échouer la vérification des types).
    // @ts-expect-error : la table des libellés n'a pas de ligne « SARL ».
    const libelles: Record<StatutJuridique | "SARL", string> = LIBELLES_DES_STATUTS
    // @ts-expect-error : l'imposition de « SARL » n'est pas dite.
    const imposition: Record<StatutJuridique | "SARL", "IS" | "IR"> = IMPOSITION_DES_STATUTS
    // Le type des sociétés se déduit de l'imposition : l'EI, à l'IR, n'en est pas une.
    // @ts-expect-error : « EI » n'est pas un StatutSociete.
    const societe: StatutSociete = "EI"
    expect([libelles, imposition, societe].map(valeur => typeof valeur)).toEqual(["object", "object", "string"])
  })
})
