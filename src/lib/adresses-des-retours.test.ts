// src/lib/adresses-des-retours.test.ts

import { describe, expect, it } from "vitest"
import { ADRESSE_E_MAIL_DES_RETOURS, ADRESSE_NOUVEAU_TICKET, adresseExterneAutorisee } from "./adresses-des-retours"

describe("adresses externes autorisées", () => {
  it("accepte le formulaire de ticket du dépôt, prérempli ou non", () => {
    expect(adresseExterneAutorisee(ADRESSE_NOUVEAU_TICKET)).toBe(true)
    expect(adresseExterneAutorisee(`${ADRESSE_NOUVEAU_TICKET}?template=retour.yml&title=%5BRetour%5D&note=%E2%98%85`)).toBe(true)
  })

  it("accepte un e-mail à la seule adresse des retours, avec un sujet et un corps", () => {
    expect(adresseExterneAutorisee(`mailto:${ADRESSE_E_MAIL_DES_RETOURS}`)).toBe(true)
    expect(adresseExterneAutorisee(`mailto:${ADRESSE_E_MAIL_DES_RETOURS}?subject=Retour&body=Bonjour%0D%0A`)).toBe(true)
    expect(adresseExterneAutorisee(`mailto:${ADRESSE_E_MAIL_DES_RETOURS.toUpperCase()}?Subject=Retour`)).toBe(true)
  })

  it.each([
    ["autre chemin du dépôt", "https://github.com/DamienBecherini/simulateur-independant-fr/issues"],
    ["autre dépôt", "https://github.com/autre/simulateur-independant-fr/issues/new"],
    ["chemin prolongé", `${ADRESSE_NOUVEAU_TICKET}/../../settings`.replace("/../../", "/x/")],
    ["http", ADRESSE_NOUVEAU_TICKET.replace("https:", "http:")],
    ["autre domaine", "https://github.com.example.org/DamienBecherini/simulateur-independant-fr/issues/new"],
    ["identifiants", "https://utilisateur:secret@github.com/DamienBecherini/simulateur-independant-fr/issues/new"],
    ["port", "https://github.com:8443/DamienBecherini/simulateur-independant-fr/issues/new"],
    ["fichier", "file:///C:/Windows/System32/calc.exe"],
    ["javascript", "javascript:alert(1)"],
    ["autre destinataire", "mailto:quelquun@example.org"],
    ["destinataire de plus", `mailto:${ADRESSE_E_MAIL_DES_RETOURS},quelquun@example.org`],
    ["copie", `mailto:${ADRESSE_E_MAIL_DES_RETOURS}?cc=quelquun@example.org`],
    ["copie cachée", `mailto:${ADRESSE_E_MAIL_DES_RETOURS}?subject=a&bcc=quelquun@example.org`],
    ["destinataire en paramètre", `mailto:${ADRESSE_E_MAIL_DES_RETOURS}?to=quelquun@example.org`],
    ["codage invalide", "mailto:%E0%A4%A"],
    ["texte qui n'est pas une adresse", "pas une adresse"],
    ["adresse trop longue", `${ADRESSE_NOUVEAU_TICKET}?message=${"a".repeat(20_000)}`]
  ])("refuse toute autre adresse (%s)", (_cas, adresse) => {
    expect(adresseExterneAutorisee(adresse)).toBe(false)
  })

  it("refuse ce qui n'est pas une chaîne", () => {
    for (const valeur of [undefined, null, 42, { href: ADRESSE_NOUVEAU_TICKET }, [ADRESSE_NOUVEAU_TICKET]]) expect(adresseExterneAutorisee(valeur)).toBe(false)
  })
})
