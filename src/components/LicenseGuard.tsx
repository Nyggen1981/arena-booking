"use client"

import { useSession } from "next-auth/react"
import { useState, useEffect, createContext, useContext, ReactNode } from "react"
import { usePathname } from "next/navigation"
import { AlertTriangle, Key, Settings } from "lucide-react"
import Link from "next/link"

interface LicenseStatus {
  valid: boolean
  status: "active" | "grace" | "expired" | "suspended" | "invalid" | "error" | "loading"
  message?: string
  isLoading: boolean
}

const LicenseContext = createContext<LicenseStatus>({
  valid: true,
  status: "loading",
  isLoading: true
})

export function useLicense() {
  return useContext(LicenseContext)
}

// Paths that are always accessible regardless of license status
const ALLOWED_PATHS_WITHOUT_LICENSE = [
  "/admin/settings",
  "/login",
  "/register",
  "/api/",
  "/personvern"
]

// Paths that should show blocked UI (not redirected)
const PROTECTED_PATHS = [
  "/resources",
  "/calendar",
  "/my-bookings",
  "/timeline",
  "/admin",
  "/innstillinger"
]

interface LicenseGuardProps {
  children: ReactNode
}

export function LicenseGuard({ children }: LicenseGuardProps) {
  const { data: session, status: sessionStatus } = useSession()
  const pathname = usePathname()
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>({
    valid: true,
    status: "loading",
    isLoading: true
  })

  // Check if current path is always allowed
  const isAllowedPath = ALLOWED_PATHS_WITHOUT_LICENSE.some(path => 
    pathname?.startsWith(path)
  )

  // Check if current path is protected
  const isProtectedPath = PROTECTED_PATHS.some(path => 
    pathname?.startsWith(path)
  )

  useEffect(() => {
    // Only check license when logged in
    if (sessionStatus !== "authenticated") {
      setLicenseStatus({ valid: true, status: "active", isLoading: false })
      return
    }

    fetch("/api/license/status")
      .then(res => res.json())
      .then(data => {
        setLicenseStatus({
          valid: data.status === "active" || data.status === "grace",
          status: data.status || "active",
          message: data.warningMessage,
          isLoading: false
        })
      })
      .catch(() => {
        // On error, assume valid to not block accidentally
        setLicenseStatus({ valid: true, status: "error", isLoading: false })
      })
  }, [sessionStatus])

  // If still loading, show loading state
  if (licenseStatus.isLoading && sessionStatus === "authenticated") {
    return (
      <LicenseContext.Provider value={licenseStatus}>
        {children}
      </LicenseContext.Provider>
    )
  }

  // If license is invalid and we're on a protected path (not settings)
  const isAdmin = session?.user?.role === "admin"
  const licenseInvalid = licenseStatus.status === "invalid" || licenseStatus.status === "expired" || licenseStatus.status === "suspended"
  const shouldBlock = licenseInvalid && isProtectedPath && !isAllowedPath

  // Special case: admin accessing /admin but not /admin/settings
  const isAdminPageButNotSettings = pathname?.startsWith("/admin") && !pathname?.startsWith("/admin/settings")

  if (shouldBlock && isAdmin && isAdminPageButNotSettings) {
    // Admin can only access settings when license is invalid
    return (
      <LicenseContext.Provider value={licenseStatus}>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <Key className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Lisens ikke aktiv
            </h1>
            <p className="text-gray-600 mb-6">
              {licenseStatus.message || "Lisensen for denne organisasjonen er ikke konfigurert eller har utløpt."}
            </p>
            <Link 
              href="/admin/settings"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              <Settings className="w-5 h-5" />
              Gå til innstillinger
            </Link>
            <p className="text-sm text-gray-500 mt-4">
              Konfigurer lisensnøkkelen i innstillingene for å aktivere appen.
            </p>
          </div>
        </div>
      </LicenseContext.Provider>
    )
  }

  if (shouldBlock && !isAdmin) {
    // Non-admin users see a different message
    return (
      <LicenseContext.Provider value={licenseStatus}>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Tjenesten er midlertidig utilgjengelig
            </h1>
            <p className="text-gray-600 mb-6">
              Kontakt administrator for mer informasjon.
            </p>
          </div>
        </div>
      </LicenseContext.Provider>
    )
  }

  return (
    <LicenseContext.Provider value={licenseStatus}>
      {children}
    </LicenseContext.Provider>
  )
}

