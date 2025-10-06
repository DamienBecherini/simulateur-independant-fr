// src/lib/avatar-utils.ts

import type { Avatar } from "@/types"

/**
 * Génère les initiales à partir d'un nom complet.
 * @param name - Le nom de la personne.
 * @returns Une chaîne de 2 caractères en majuscules pour les initiales.
 */
export function getInitials(name: string): string {
  if (!name) return "NP" // NP pour "Nouvelle Personne" ou "Non Précisé"

  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase()
}

/**
 * Met à jour un avatar de personne en fonction de son nom.
 * Ne modifie que la valeur (initiales), conserve le reste (couleur, etc.).
 * @param avatar - L'avatar existant.
 * @param personName - Le nouveau nom de la personne.
 * @returns Le nouvel objet avatar mis à jour.
 */
export function updatePersonAvatar(avatar: Avatar, personName: string): Avatar {
  const initials = getInitials(personName)
  return {
    ...avatar,
    value: initials,
    type: "initials" // S'assurer que le type est correct
  }
}
