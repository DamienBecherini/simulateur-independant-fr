// src/lib/avatar-constants.ts
import { Briefcase, Building, Store, User } from "lucide-react"

// On exporte les constantes depuis ce fichier dédié.
export const availableIcons: { [key: string]: React.ReactNode } = {
  Briefcase: <Briefcase size={20} />,
  Building: <Building size={20} />,
  Store: <Store size={20} />,
  User: <User size={20} />
}

export const availableIconsSmall: { [key: string]: React.ReactNode } = {
  Briefcase: <Briefcase size={16} />,
  Building: <Building size={16} />,
  Store: <Store size={16} />,
  User: <User size={16} />
}
