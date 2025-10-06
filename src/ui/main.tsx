import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import "./App.css"
import { NotificationProvider } from "./components/NotificationProvider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NotificationProvider />
    <App />
  </StrictMode>
)
