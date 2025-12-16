"use client"

import { useState, useEffect } from "react"
import { X, Info } from "lucide-react"

export function CalendarHelpBanner() {
  const [isDismissed, setIsDismissed] = useState(true)

  useEffect(() => {
    // Sjekk om brukeren har krysse ut advarselen
    const dismissed = localStorage.getItem("calendar-help-dismissed")
    setIsDismissed(dismissed === "true")
  }, [])

  const handleDismiss = () => {
    localStorage.setItem("calendar-help-dismissed", "true")
    setIsDismissed(true)
  }

  if (isDismissed) {
    return null
  }

  return (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 text-blue-400 hover:text-blue-600 transition-colors"
        aria-label="Lukk"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3 pr-8">
        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="font-medium text-blue-900 mb-1">
            Slik finner du frem i kalenderen:
          </h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Velg først en kategori</li>
            <li>Deretter en fasilitet</li>
            <li>Hvis fasiliteten har underdeler, kan du velge en spesifikk del eller se alle deler</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

