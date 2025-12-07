"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import Link from "next/link"
import { 
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Save,
  Building2
} from "lucide-react"

interface Category {
  id: string
  name: string
  color: string
}

interface Part {
  name: string
  description: string
  capacity: string
}

export default function NewResourcePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState("")

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [minBookingMinutes, setMinBookingMinutes] = useState("60")
  const [maxBookingMinutes, setMaxBookingMinutes] = useState("240")
  const [requiresApproval, setRequiresApproval] = useState(true)
  const [advanceBookingDays, setAdvanceBookingDays] = useState("30")
  const [parts, setParts] = useState<Part[]>([])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    fetch("/api/admin/categories")
      .then(res => res.json())
      .then(data => {
        setCategories(data)
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  const addPart = () => {
    setParts([...parts, { name: "", description: "", capacity: "" }])
  }

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index))
  }

  const updatePart = (index: number, field: keyof Part, value: string) => {
    const newParts = [...parts]
    newParts[index][field] = value
    setParts(newParts)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          location,
          categoryId: categoryId || null,
          minBookingMinutes: parseInt(minBookingMinutes),
          maxBookingMinutes: parseInt(maxBookingMinutes),
          requiresApproval,
          advanceBookingDays: parseInt(advanceBookingDays),
          parts: parts.filter(p => p.name.trim()).map(p => ({
            name: p.name,
            description: p.description || null,
            capacity: p.capacity ? parseInt(p.capacity) : null
          }))
        })
      })

      if (!response.ok) {
        throw new Error("Kunne ikke opprette fasilitet")
      }

      router.push("/admin/resources")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noe gikk galt")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin/resources" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Tilbake til fasiliteter
        </Link>

        <div className="card p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Ny fasilitet</h1>
              <p className="text-gray-500 text-sm">Legg til en ny fasilitet som kan bookes</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Basic info */}
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 border-b pb-2">Grunnleggende info</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Navn *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                  placeholder="F.eks. Hovedstadion"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Beskrivelse
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input min-h-[100px]"
                  placeholder="Beskriv fasiliteten..."
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lokasjon
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="input"
                    placeholder="F.eks. Idrettsveien 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="input"
                  >
                    <option value="">Velg kategori...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Booking settings */}
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 border-b pb-2">Booking-innstillinger</h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min. varighet (minutter)
                  </label>
                  <input
                    type="number"
                    value={minBookingMinutes}
                    onChange={(e) => setMinBookingMinutes(e.target.value)}
                    className="input"
                    min="15"
                    step="15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maks. varighet (minutter)
                  </label>
                  <input
                    type="number"
                    value={maxBookingMinutes}
                    onChange={(e) => setMaxBookingMinutes(e.target.value)}
                    className="input"
                    min="15"
                    step="15"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forhåndsbestilling (dager frem)
                </label>
                <input
                  type="number"
                  value={advanceBookingDays}
                  onChange={(e) => setAdvanceBookingDays(e.target.value)}
                  className="input max-w-[200px]"
                  min="1"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requiresApproval"
                  checked={requiresApproval}
                  onChange={(e) => setRequiresApproval(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="requiresApproval" className="text-sm text-gray-700">
                  Krever godkjenning fra admin før booking er bekreftet
                </label>
              </div>
            </div>

            {/* Parts */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h2 className="font-semibold text-gray-900">Deler som kan bookes separat</h2>
                <button
                  type="button"
                  onClick={addPart}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Legg til del
                </button>
              </div>

              {parts.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Ingen deler lagt til. Hele fasiliteten vil bli booket som én enhet.
                </p>
              ) : (
                <div className="space-y-3">
                  {parts.map((part, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Del {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removePart(index)}
                          className="text-red-500 hover:text-red-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid md:grid-cols-3 gap-3">
                        <input
                          type="text"
                          value={part.name}
                          onChange={(e) => updatePart(index, "name", e.target.value)}
                          className="input"
                          placeholder="Navn (f.eks. Bane 1)"
                        />
                        <input
                          type="text"
                          value={part.description}
                          onChange={(e) => updatePart(index, "description", e.target.value)}
                          className="input"
                          placeholder="Beskrivelse"
                        />
                        <input
                          type="number"
                          value={part.capacity}
                          onChange={(e) => updatePart(index, "capacity", e.target.value)}
                          className="input"
                          placeholder="Kapasitet"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary flex-1 py-3 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Oppretter...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Opprett fasilitet
                  </>
                )}
              </button>
              <Link href="/admin/resources" className="btn btn-secondary py-3">
                Avbryt
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

