// src/ui/components/Results.tsx

import { useState } from "react"
import type { SessionState, SimulationOutput, CompanyResult, PersonResult, HouseholdResult, IncomeFromCompany } from "@/types"
import { Button } from "@/components/ui/button"
import { Rocket, Loader2, ChevronsUpDown, Building, User, Users } from "lucide-react"
import { AvatarDisplay } from "./AvatarDisplay"

// --- CORRECTION: Déclaration de l'interface manquante ---
interface ResultsProps {
  currentSession: SessionState
}
// --- FIN CORRECTION ---

// --- SOUS-COMPOSANTS DE PRÉSENTATION ---

const ResultCard: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="bg-slate-100 dark:bg-gray-800 rounded-lg p-4">
    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-200">
      {icon} {title}
    </h3>
    <div className="space-y-2">{children}</div>
  </div>
)

const ResultRow: React.FC<{ label: string; value: string | number; isSub?: boolean; isBold?: boolean; isTotal?: boolean; className?: string }> = ({ label, value, isSub = false, isBold = false, isTotal = false, className = "" }) => (
  <div className={`flex justify-between items-center text-sm ${isSub ? "ml-4" : ""} ${isTotal ? "border-t pt-2 mt-2" : ""} ${className}`}>
    <p className={isBold ? "font-semibold text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"}>{label}</p>
    <p className={`font-mono ${isBold || isTotal ? "font-bold text-slate-900 dark:text-slate-50" : "text-slate-700 dark:text-slate-200"}`}>{typeof value === "number" ? value.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €" : value}</p>
  </div>
)

const CompanyResultDisplay: React.FC<{ result: CompanyResult }> = ({ result }) => {
  if (result.type === "MicroEntreprise") {
    const d = result.details
    return (
      <ResultCard title={result.name} icon={<Building className="h-5 w-5" />}>
        <ResultRow label="Statut" value="Micro-Entreprise" />
        {d.warning && <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-md">{d.warning}</p>}
        <ResultRow label="Chiffre d'Affaires Total" value={d.turnover.total} isBold />
        <ResultRow label="CA Services (BIC)" value={d.turnover.servicesBic} isSub />
        <ResultRow label="CA Services (BNC)" value={d.turnover.servicesBnc} isSub />
        <ResultRow label="CA Ventes" value={d.turnover.sales} isSub />
        <ResultRow label="Cotisations URSSAF (Total)" value={-d.socialContributions.total} isBold />
        <ResultRow label="Cotisations BIC" value={-d.socialContributions.servicesBic} isSub />
        <ResultRow label="Cotisations BNC" value={-d.socialContributions.servicesBnc} isSub />
        <ResultRow label="Cotisations Ventes" value={-d.socialContributions.sales} isSub />
        <ResultRow label="Dépenses réelles" value={-d.realExpenses} />
        {d.vflTax > 0 && <ResultRow label="Impôt libératoire (VFL)" value={-d.vflTax} />}
        <ResultRow label="Net de trésorerie (pour la personne)" value={d.netCashFlow} isTotal />
        <ResultRow label="Revenu imposable (transmis au foyer)" value={d.taxableIncomeAfterAbattement} isBold />
      </ResultCard>
    )
  }
  return (
    <ResultCard title={result.name} icon={<Building className="h-5 w-5" />}>
      <ResultRow label="Statut" value={result.type} />
      <ResultRow label="Chiffre d'Affaires" value={result.details.turnover} />
    </ResultCard>
  )
}

const DetailedIncomeRow: React.FC<{ income: IncomeFromCompany }> = ({ income }) => (
  <div className="flex justify-between items-center text-sm ml-4">
    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
      <AvatarDisplay avatar={income.avatar} size="sm" />
      <span>{income.companyName}</span>
    </div>
    <p className="font-mono text-slate-700 dark:text-slate-200">{income.amount.toLocaleString("fr-FR")} €</p>
  </div>
)

const PersonResultDisplay: React.FC<{ result: PersonResult }> = ({ result }) => {
  // --- CORRECTION: Ajout d'une vérification pour s'assurer que fromOwnedCompanies est un tableau ---
  const fromOwnedCompaniesArray = Array.isArray(result.cashInflows.fromOwnedCompanies) ? result.cashInflows.fromOwnedCompanies : []
  const totalFromCompanies = fromOwnedCompaniesArray.reduce((sum, c) => sum + c.amount, 0)
  // --- FIN DE LA CORRECTION ---
  return (
    <ResultCard title={result.name} icon={<User className="h-5 w-5" />}>
      <ResultRow label="Salaires & ARE" value={result.cashInflows.salaries + result.cashInflows.unemploymentBenefits} />
      <ResultRow label="Argent reçu des activités (total)" value={totalFromCompanies} />
      {fromOwnedCompaniesArray.map(income => (
        <DetailedIncomeRow key={income.companyId} income={income} />
      ))}
      <ResultRow label="Autres revenus" value={result.cashInflows.otherTaxableIncome} />
      <ResultRow label="Dépenses personnelles" value={-result.personalExpenses} className="text-red-600 dark:text-red-400" />
      <ResultRow label="Revenu imposable (transmis au foyer)" value={result.totalTaxableIncome} isTotal />
    </ResultCard>
  )
}

const HouseholdResultDisplay: React.FC<{ result: HouseholdResult }> = ({ result }) => (
  <div className="bg-blue-50 dark:bg-blue-900/40 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
    <h3 className="text-xl font-bold mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-200">
      <Users className="h-6 w-6" /> Foyer Fiscal : {result.personNames.join(" & ")}
    </h3>
    <div className="space-y-2">
      <ResultRow label="Revenu imposable total du foyer" value={result.totalTaxableIncome} isBold />
      <ResultRow label="Parts fiscales" value={result.totalFiscalParts.toString()} />
      <ResultRow label="Impôt total sur le revenu" value={-result.incomeTax} isBold />
      <ResultRow label="Net dans la poche final (après IR)" value={result.finalNetInPocket} isTotal />
    </div>
  </div>
)

// --- COMPOSANT PRINCIPAL ---

export function Results({ currentSession }: ResultsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<SimulationOutput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRawVisible, setRawVisible] = useState(false)

  const handleRunSimulation = async () => {
    setIsLoading(true)
    setResults(null)
    setError(null)
    try {
      const simulationResults = await window.api.runSimulation(currentSession)
      setResults(simulationResults)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Une erreur inconnue est survenue."
      console.error("Erreur lors de la simulation:", errorMessage)
      setError("Le moteur de calcul a rencontré une erreur. Veuillez vérifier les logs.")
    } finally {
      setIsLoading(false)
    }
  }

  const isButtonDisabled = isLoading || currentSession.entities.length === 0

  return (
    <div className="p-6 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md mt-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div>
          <h2 className="text-2xl font-semibold">Résultats de la Simulation</h2>
          <p className="text-slate-500">Cliquez pour calculer les impôts et le revenu net global.</p>
        </div>
        <Button onClick={handleRunSimulation} disabled={isButtonDisabled} size="lg" className="mt-3 sm:mt-0">
          {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Rocket className="mr-2 h-5 w-5" />}
          {isLoading ? "Calcul en cours..." : "Lancer la simulation"}
        </Button>
      </div>

      <div className="mt-6 border-t pt-4">
        {!results && !error && !isLoading && <p className="text-center text-slate-500 py-4">Les résultats de la simulation s'afficheront ici.</p>}
        {isLoading && <p className="text-center text-slate-500 py-4">Analyse du graphe et calcul des agrégats...</p>}
        {error && <p className="text-center text-red-500 font-semibold py-4">{error}</p>}

        {results && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.companyResults.map(res => (
                <CompanyResultDisplay key={res.id} result={res} />
              ))}
              {results.personResults.map(res => (
                <PersonResultDisplay key={res.id} result={res} />
              ))}
            </div>
            <div className="space-y-4">
              {results.householdResults.map(res => (
                <HouseholdResultDisplay key={res.id} result={res} />
              ))}
            </div>

            <div className="text-center pt-4">
              <Button variant="ghost" size="sm" onClick={() => setRawVisible(!isRawVisible)}>
                <ChevronsUpDown className="mr-2 h-4 w-4" />
                {isRawVisible ? "Masquer" : "Afficher"} les données brutes
              </Button>
            </div>
            {isRawVisible && (
              <div className="p-4 bg-slate-200 dark:bg-gray-900 rounded-md mt-2">
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(results, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
