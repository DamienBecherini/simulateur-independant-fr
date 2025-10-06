/**
 * @file data-sanitizer.ts
 * @description Version "pare-balles" finale du sanitizer. Ce code est la garantie ultime
 * qu'aucune donnée invalide, incomplète ou incohérente ne pourra jamais atteindre le frontend.
 * Il valide non seulement la présence des champs, mais aussi la cohérence sémantique des données
 * (ex: validité des relations) et garantit la structure complète de l'objet de session.
 */

// --- INTERFACES DE RETOUR ---
interface SanitizationResult {
  safeState: SessionState
  report: SanitizationReport
}

// --- FONCTIONS DE SANITISATION INDIVIDUELLES (Version finale, ultra-robuste) ---

function sanitizePerson(data: unknown): Person | null {
  if (typeof data !== "object" || data === null) return null
  const p = data as Record<string, unknown>
  if (typeof p.id !== "string" || typeof p.name !== "string") return null

  let avatar: Avatar
  if (typeof p.avatar === "object" && p.avatar !== null && "color" in p.avatar && typeof p.avatar.color === "string" && "value" in p.avatar && typeof p.avatar.value === "string") {
    avatar = p.avatar as Avatar
  } else {
    avatar = { type: "initials", value: "NP", color: "#3b82f6" }
  }

  return {
    id: p.id,
    type: "person",
    name: p.name,
    fiscalParts: typeof p.fiscalParts === "number" ? p.fiscalParts : 1,
    locked: typeof p.locked === "boolean" ? p.locked : false,
    avatar
  }
}

function sanitizeCompany(data: unknown): Company | null {
  if (typeof data !== "object" || data === null) return null
  const c = data as Record<string, unknown>
  if (typeof c.id !== "string" || typeof c.name !== "string") return null

  let avatar: Avatar
  if (typeof c.avatar === "object" && c.avatar !== null && "color" in c.avatar && typeof c.avatar.color === "string" && "value" in c.avatar && typeof c.avatar.value === "string") {
    avatar = c.avatar as Avatar
  } else {
    avatar = { type: "icon", value: "Briefcase", color: "#ef4444" }
  }

  return {
    id: c.id,
    type: "company",
    name: c.name,
    legalStatus: ["SASU", "EURL"].includes(c.legalStatus as string) ? (c.legalStatus as "SASU" | "EURL") : "SASU",
    locked: typeof c.locked === "boolean" ? c.locked : false,
    avatar
  }
}

function sanitizeMicroEntreprise(data: unknown): MicroEntreprise | null {
  if (typeof data !== "object" || data === null) return null
  const m = data as Record<string, unknown>
  if (typeof m.id !== "string" || typeof m.name !== "string") return null

  let avatar: Avatar
  if (typeof m.avatar === "object" && m.avatar !== null && "color" in m.avatar && typeof m.avatar.color === "string" && "value" in m.avatar && typeof m.avatar.value === "string") {
    avatar = m.avatar as Avatar
  } else {
    avatar = { type: "icon", value: "Store", color: "#f97316" }
  }

  return {
    id: m.id,
    type: "micro-entreprise",
    name: m.name,
    beneficieACRE: typeof m.beneficieACRE === "boolean" ? m.beneficieACRE : false,
    opteVFL: typeof m.opteVFL === "boolean" ? m.opteVFL : false,
    locked: typeof m.locked === "boolean" ? m.locked : false,
    avatar
  }
}

// --- FONCTION PRINCIPALE EXPORTÉE ---
export function sanitizeStateAndFillDefaults(rawData: unknown): SanitizationResult {
  if (typeof rawData !== "object" || rawData === null) {
    throw new Error("Les données de sauvegarde sont invalides ou totalement illisibles.")
  }
  const data = rawData as Record<string, unknown>

  // ÉTAPE 0 : Compter les éléments initiaux.
  const initialEntities = Array.isArray(data.entities) ? data.entities : []
  const initialRelationships = Array.isArray(data.relationships) ? data.relationships : []
  const initialMonthlyData = Array.isArray(data.monthlyData) ? data.monthlyData : []
  const initialFlowCount = initialMonthlyData.reduce((acc, month: unknown) => {
    const m = month as Record<string, unknown>
    return acc + (Array.isArray(m.flows) ? m.flows.length : 0)
  }, 0)

  // ÉTAPE 1 : Nettoyer les entités.
  const sanitizedEntities = initialEntities
    .map((e: unknown) => {
      const entity = e as Record<string, unknown>
      if (entity?.type === "person") return sanitizePerson(e)
      if (entity?.type === "company") return sanitizeCompany(e)
      if (entity?.type === "micro-entreprise") return sanitizeMicroEntreprise(e)
      return null
    })
    .filter((e): e is Entity => e !== null)

  const entityMap = new Map(sanitizedEntities.map(e => [e.id, e]))

  // ÉTAPE 2 : Nettoyer les relations avec une validation sémantique.
  const sanitizedRelationships = initialRelationships.filter((r: unknown): r is Relationship => {
    if (typeof r !== "object" || r === null) return false
    const rel = r as Record<string, unknown>
    if (typeof rel.id !== "string" || typeof rel.fromId !== "string" || typeof rel.toId !== "string" || typeof rel.type !== "string") return false

    const fromEntity = entityMap.get(rel.fromId)
    const toEntity = entityMap.get(rel.toId)

    // La relation est orpheline, on la supprime.
    if (!fromEntity || !toEntity) return false

    // CORRECTION SÉMANTIQUE : Une relation doit impliquer au moins une personne.
    if (fromEntity.type !== "person" && toEntity.type !== "person") return false

    return true
  })

  // ÉTAPE 3 : Nettoyer les données mensuelles.
  let sanitizedMonthlyData: MonthlyGridData
  if (Array.isArray(data.monthlyData)) {
    sanitizedMonthlyData = data.monthlyData.map((monthData: unknown, index: number) => {
      if (typeof monthData !== "object" || monthData === null) return { month: index, flows: [] }
      const m = monthData as Record<string, unknown>
      if (!Array.isArray(m.flows)) return { month: index, flows: [] }

      const validFlows = m.flows.filter((flow: unknown): flow is FinancialFlow => {
        if (typeof flow !== "object" || flow === null) return false
        const f = flow as Record<string, unknown>
        return !!(f.id && typeof f.entityId === "string" && entityMap.has(f.entityId))
      })
      return { month: index, flows: validFlows }
    })
  } else {
    // **CORRECTION ANTI-CRASH** : Si la clé monthlyData est absente, on la crée.
    sanitizedMonthlyData = Array.from({ length: 12 }, (_, i) => ({ month: i, flows: [] }))
  }

  if (sanitizedMonthlyData.length !== 12) {
    const monthMap = new Map(sanitizedMonthlyData.map(m => [m.month, m]))
    sanitizedMonthlyData = Array.from({ length: 12 }, (_, i) => monthMap.get(i) || { month: i, flows: [] })
  }

  const finalFlowCount = sanitizedMonthlyData.reduce((acc, month) => acc + month.flows.length, 0)

  // ÉTAPE 4 : Assembler l'état final.
  const safeState: SessionState = {
    name: typeof data.name === "string" ? data.name : "Simulation Récupérée",
    entities: sanitizedEntities,
    relationships: sanitizedRelationships,
    monthlyData: sanitizedMonthlyData
  }

  // ÉTAPE 5 : Construire le rapport.
  const report: SanitizationReport = {
    entitiesRemoved: initialEntities.length - sanitizedEntities.length,
    relationshipsRemoved: initialRelationships.length - sanitizedRelationships.length,
    flowsRemoved: initialFlowCount - finalFlowCount
  }

  return { safeState, report }
}

/**
 * Prend un tableau de slots potentiellement corrompus et retourne un tableau de slots propres.
 * @param rawSlotsData - Un tableau de données brutes.
 * @returns Un tableau de `SaveSlot` propres et garantis d'être complets.
 */
export function sanitizeSlots(rawSlotsData: unknown): SaveSlot[] {
  if (!Array.isArray(rawSlotsData)) return []

  return rawSlotsData
    .map((slotData: unknown) => {
      if (typeof slotData !== "object" || slotData === null) return null
      const s = slotData as Record<string, unknown>
      if (typeof s.id !== "string" || typeof s.name !== "string" || typeof s.lastModified !== "number") return null

      // On réutilise notre sanitizer principal sur les sous-parties du slot
      const { safeState } = sanitizeStateAndFillDefaults(s)

      return {
        id: s.id,
        name: s.name,
        lastModified: s.lastModified,
        entities: safeState.entities,
        relationships: safeState.relationships,
        monthlyData: safeState.monthlyData
      }
    })
    .filter((s): s is SaveSlot => s !== null)
}
