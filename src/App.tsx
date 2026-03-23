/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react"
import { AdminPanel } from "@/components/AdminPanel"
import { ConfirmationForm } from "@/components/ConfirmationForm"

export default function App() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname)
    }

    window.addEventListener("popstate", handleLocationChange)
    
    // Intercept link clicks to handle internal routing
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest("a")
      if (anchor && anchor.href.startsWith(window.location.origin)) {
        const url = new URL(anchor.href)
        if (url.pathname !== window.location.pathname) {
          e.preventDefault()
          window.history.pushState({}, "", url.pathname)
          setPath(url.pathname)
        }
      }
    }
    document.addEventListener("click", handleLinkClick)

    return () => {
      window.removeEventListener("popstate", handleLocationChange)
      document.removeEventListener("click", handleLinkClick)
    }
  }, [])

  // Simple routing logic
  if (path.startsWith("/confirmacao/")) {
    const id = path.split("/").pop() || ""
    return <ConfirmationForm solicitacaoId={id} />
  }

  if (path.startsWith("/visualizar/")) {
    const id = path.split("/").pop() || ""
    return <ConfirmationForm solicitacaoId={id} readOnly={true} />
  }

  return <AdminPanel />
}
