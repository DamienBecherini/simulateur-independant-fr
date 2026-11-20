// src/lib/notes.ts
// Notes de bas de tableau : chaque avertissement distinct reçoit un numéro, que les colonnes concernées affichent
// en renvoi. Un même avertissement présent dans plusieurs colonnes garde un seul numéro. Une note qui concerne la
// colonne du statut actuel parle de la situation réelle : l'affichage « Résumé », qui replie les autres, la garde écrite.

export interface Note {
  numero: number
  texte: string
  /** Libellés des colonnes concernées, dans l'ordre du tableau. */
  colonnes: string[]
  /** Vrai si la note concerne la colonne du statut actuel de l'activité. */
  duStatutActuel: boolean
}

export interface Notes {
  notes: Note[]
  /** Numéros des notes de chaque colonne, par identifiant de colonne. */
  renvois: Map<string, number[]>
}

export function numeroterNotes(colonnes: { id: string; libelle: string; avertissements: string[]; actuelle?: boolean }[]): Notes {
  const parTexte = new Map<string, Note>()
  const renvois = new Map<string, number[]>()
  for (const colonne of colonnes) {
    const numeros = new Set<number>()
    for (const texte of colonne.avertissements) {
      let note = parTexte.get(texte)
      if (!note) {
        note = { numero: parTexte.size + 1, texte, colonnes: [], duStatutActuel: false }
        parTexte.set(texte, note)
      }
      if (colonne.actuelle) note.duStatutActuel = true
      if (!note.colonnes.includes(colonne.libelle)) note.colonnes.push(colonne.libelle)
      numeros.add(note.numero)
    }
    renvois.set(colonne.id, [...numeros])
  }
  return { notes: [...parTexte.values()], renvois }
}
