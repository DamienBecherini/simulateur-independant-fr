// src/lib/avatar-utils.test.ts

import { describe, expect, it } from "vitest"
import { getInitials, updatePersonAvatar } from "@/lib/avatar-utils"
import type { Avatar } from "@/types"

describe("getInitials", () => {
  it("prend la première lettre du prénom et du nom", () => {
    expect(getInitials("Alice Martin")).toBe("AM")
  })

  it("met les initiales en majuscules", () => {
    expect(getInitials("alice martin")).toBe("AM")
  })

  it("se limite aux deux premiers mots", () => {
    expect(getInitials("Jean Pierre De La Fontaine")).toBe("JP")
  })

  it("renvoie une seule lettre pour un nom d'un seul mot", () => {
    expect(getInitials("Alice")).toBe("A")
  })

  it("renvoie « NP » pour un nom vide", () => {
    expect(getInitials("")).toBe("NP")
  })

  it("ignore les espaces en trop", () => {
    expect(getInitials("  Alice   Martin ")).toBe("AM")
  })
})

describe("updatePersonAvatar", () => {
  it("remplace la valeur par les initiales en conservant la couleur", () => {
    const avatar: Avatar = { type: "initials", value: "NP", color: "#3b82f6" }

    expect(updatePersonAvatar(avatar, "Bruno Dupont")).toEqual({ type: "initials", value: "BD", color: "#3b82f6" })
  })

  it("repasse un avatar à icône en avatar à initiales", () => {
    const avatar: Avatar = { type: "icon", value: "User", color: "#ef4444" }

    expect(updatePersonAvatar(avatar, "Chloé Bernard")).toEqual({ type: "initials", value: "CB", color: "#ef4444" })
  })

  it("ne modifie pas l'avatar reçu", () => {
    const avatar: Avatar = { type: "initials", value: "NP", color: "#3b82f6" }

    updatePersonAvatar(avatar, "Bruno Dupont")

    expect(avatar).toEqual({ type: "initials", value: "NP", color: "#3b82f6" })
  })
})
