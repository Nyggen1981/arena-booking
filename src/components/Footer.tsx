"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import packageJson from "../../package.json"

const VERSION = packageJson.version

interface Organization {
  name: string
  invoiceOrgNumber: string | null
  invoiceAddress: string | null
  invoicePhone: string | null
  invoiceEmail: string | null
}

export function Footer() {
  const [pricingEnabled, setPricingEnabled] = useState(false)
  const [organization, setOrganization] = useState<Organization | null>(null)

  useEffect(() => {
    // Sjekk om pricing er aktivert
    fetch("/api/pricing/status")
      .then(res => res.json())
      .then(data => setPricingEnabled(data.enabled || false))
      .catch(() => setPricingEnabled(false))
    
    // Hent organisasjonsinformasjon
    fetch("/api/organization")
      .then(res => res.json())
      .then(data => setOrganization(data))
      .catch(() => {})
  }, [])

  return (
    <footer className="bg-slate-900 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
          {/* SportFlow Brand - Left */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center">
              <Image 
                src="/kvadratisk-logo.png" 
                alt="SF Logo" 
                width={56} 
                height={56} 
                className="object-contain"
              />
            </div>
            <div>
              <h3 className="font-bold text-base">SportFlow</h3>
              <p className="text-slate-400 text-xs">Smartere klubbdrift</p>
            </div>
          </div>

          {/* Organization Info - Center */}
          {organization && (organization.invoiceOrgNumber || organization.invoiceAddress) && (
            <div className="text-center md:text-left">
              {organization.name && (
                <p className="text-sm font-medium text-white mb-1">{organization.name}</p>
              )}
              <div className="text-xs text-slate-400 space-y-0.5">
                {organization.invoiceOrgNumber && (
                  <p>Org.nr: {organization.invoiceOrgNumber}</p>
                )}
                {organization.invoiceAddress && (
                  <p>{organization.invoiceAddress}</p>
                )}
                {organization.invoicePhone && (
                  <p>Tlf: {organization.invoicePhone}</p>
                )}
                {organization.invoiceEmail && (
                  <p>E-post: {organization.invoiceEmail}</p>
                )}
              </div>
            </div>
          )}

          {/* Links and Copyright - Right */}
          <div className="text-center md:text-right flex flex-col items-center md:items-end gap-1">
            <div className="flex flex-col sm:flex-row items-center md:items-end gap-2 sm:gap-4">
              <Link 
                href="/personvern" 
                className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                Personvernpolicy
              </Link>
              {pricingEnabled && (
                <Link 
                  href="/salgsvilkaar" 
                  className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Salgsvilkår
                </Link>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              &copy; {new Date().getFullYear()} SportFlow. Alle rettigheter reservert.
            </p>
            <p className="text-xs text-slate-600 mt-1">
              v{VERSION}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
