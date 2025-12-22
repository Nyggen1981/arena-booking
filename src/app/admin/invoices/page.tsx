"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { InvoiceManagement } from "@/components/InvoiceManagement"

export default function AdminInvoicesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pricingEnabled, setPricingEnabled] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    } else {
      // Check if pricing is enabled
      fetch("/api/pricing/status")
        .then(res => res.json())
        .then(data => setPricingEnabled(data.enabled || false))
        .catch(() => setPricingEnabled(false))
    }
  }, [status, session, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <p className="text-gray-500">Laster...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-6">
            <Link 
              href="/admin" 
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Tilbake til admin
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              Fakturaer
            </h1>
            <p className="text-sm sm:text-base text-gray-500">Oversikt over alle fakturaer</p>
          </div>

          {/* Invoice Management */}
          {pricingEnabled ? (
            <div className="card p-6">
              <InvoiceManagement />
            </div>
          ) : (
            <div className="card p-6 text-center">
              <p className="text-gray-500">Fakturafunksjonen er kun tilgjengelig når "pris og betaling" modulen er aktivert.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}

