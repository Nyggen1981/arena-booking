"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import Image from "next/image"
import { 
  ArrowLeft,
  Loader2,
  Save,
  Building2,
  Upload,
  X,
  ImageIcon,
  Map,
  Users,
  ShieldCheck,
  Plus,
  Trash2
} from "lucide-react"
import { MapEditor } from "@/components/MapEditor"
import { PartsHierarchyEditor, HierarchicalPart } from "@/components/PartsHierarchyEditor"

interface Category {
  id: string
  name: string
  color: string
}

interface Part {
  id?: string
  tempId?: string
  name: string
  description: string
  capacity: string
  mapCoordinates?: string | null
  adminNote?: string | null
  image?: string | null
  parentId?: string | null
  isNew?: boolean
}

interface Props {
  params: Promise<{ id: string }>
}

export default function EditResourcePage({ params }: Props) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [color, setColor] = useState("")
  const [image, setImage] = useState<string | null>(null)
  const [limitDuration, setLimitDuration] = useState(false)
  const [minBookingMinutes, setMinBookingMinutes] = useState("60")
  const [maxBookingMinutes, setMaxBookingMinutes] = useState("240")
  const [requiresApproval, setRequiresApproval] = useState(true)
  const [limitAdvanceBooking, setLimitAdvanceBooking] = useState(true)
  const [advanceBookingDays, setAdvanceBookingDays] = useState("30")
  const [showOnPublicCalendar, setShowOnPublicCalendar] = useState(true)
  const [allowWholeBooking, setAllowWholeBooking] = useState(true)
  const [mapImage, setMapImage] = useState<string | null>(null)
  const [parts, setParts] = useState<Part[]>([])
  const [prisInfo, setPrisInfo] = useState("")
  const [visPrisInfo, setVisPrisInfo] = useState(false)
  
  // Pricing state (kun aktiv hvis lisensserver tillater det)
  const [pricingEnabled, setPricingEnabled] = useState(false)
  const [pricingRules, setPricingRules] = useState<Array<{
    forRoles: string[]
    model: "FREE" | "HOURLY" | "DAILY" | "FIXED" | "FIXED_DURATION"
    pricePerHour?: string
    pricePerDay?: string
    fixedPrice?: string
    fixedPriceDuration?: string
  }>>([])
  const [customRoles, setCustomRoles] = useState<Array<{ id: string; name: string }>>([])
  
  // Moderators state
  const [moderators, setModerators] = useState<Array<{
    id: string
    user: { id: string; name: string | null; email: string; role: string }
  }>>([])
  const [availableModerators, setAvailableModerators] = useState<Array<{
    id: string
    name: string | null
    email: string
  }>>([])
  const [showAddModerator, setShowAddModerator] = useState(false)
  const [selectedModeratorId, setSelectedModeratorId] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/categories").then(res => res.json()),
      fetch(`/api/admin/resources/${id}`).then(res => res.json()),
      fetch(`/api/admin/resources/${id}/moderators`).then(res => res.json()).catch(() => []),
      fetch("/api/admin/users").then(res => res.json()).catch(() => []),
      fetch("/api/admin/roles").then(res => res.json()).catch(() => []),
      fetch("/api/pricing/status").then(res => res.json()).catch(() => ({ enabled: false }))
    ]).then(([cats, resource, mods, users, roles, pricingStatus]) => {
      setCategories(cats)
      
      setName(resource.name || "")
      setDescription(resource.description || "")
      setLocation(resource.location || "")
      setCategoryId(resource.categoryId || "")
      setColor(resource.color || "")
      setImage(resource.image || null)
      // Check for 0/9999 or null to determine if duration is limited
      const hasLimit = resource.minBookingMinutes !== null && 
                       resource.maxBookingMinutes !== null &&
                       resource.minBookingMinutes !== 0 && 
                       resource.maxBookingMinutes !== 9999
      setLimitDuration(hasLimit)
      setMinBookingMinutes(String(resource.minBookingMinutes || 60))
      setMaxBookingMinutes(String(resource.maxBookingMinutes || 240))
      setRequiresApproval(resource.requiresApproval ?? true)
      setLimitAdvanceBooking(resource.advanceBookingDays !== null)
      setAdvanceBookingDays(String(resource.advanceBookingDays || 30))
      setShowOnPublicCalendar(resource.showOnPublicCalendar ?? true)
      setAllowWholeBooking(resource.allowWholeBooking ?? true)
      setMapImage(resource.mapImage || null)
      setPrisInfo(resource.prisInfo || "")
      setVisPrisInfo(resource.visPrisInfo ?? false)
      
      // Pricing configuration (kun hvis aktivert)
      setPricingEnabled(pricingStatus.enabled || false)
      if (pricingStatus.enabled) {
        setPricingModel(resource.pricingModel || "FREE")
        setPricePerHour(resource.pricePerHour ? String(resource.pricePerHour) : "")
        setPricePerDay(resource.pricePerDay ? String(resource.pricePerDay) : "")
        setFixedPrice(resource.fixedPrice ? String(resource.fixedPrice) : "")
        setFixedPriceDuration(resource.fixedPriceDuration ? String(resource.fixedPriceDuration) : "")
        setFreeForRoles(resource.freeForRoles ? JSON.parse(resource.freeForRoles) : [])
        setCustomRoles(roles || [])
      }
      
      setParts(resource.parts?.map((p: { id: string; name: string; description?: string; capacity?: number; mapCoordinates?: string; adminNote?: string; image?: string; parentId?: string }) => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
        capacity: p.capacity ? String(p.capacity) : "",
        mapCoordinates: p.mapCoordinates || null,
        adminNote: p.adminNote || null,
        image: p.image || null,
        parentId: p.parentId || null
      })) || [])
      
      // Set moderators
      setModerators(mods || [])
      
      // Set available moderators (users with moderator role who aren't already moderators)
      const moderatorUserIds = (mods || []).map((m: any) => m.user.id)
      const available = (users || []).filter((u: any) => 
        u.role === "moderator" && u.isApproved && !moderatorUserIds.includes(u.id)
      )
      setAvailableModerators(available)
      
      setIsLoading(false)
    }).catch(() => {
      setError("Kunne ikke laste fasilitet")
      setIsLoading(false)
    })
  }, [id])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1024 * 1024) {
      setError("Bildet er for stort. Maks 1MB.")
      return
    }

    if (!file.type.startsWith("image/")) {
      setError("Filen må være et bilde")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setImage(reader.result as string)
      setError("")
    }
    reader.readAsDataURL(file)
  }

  const removeImage = () => {
    setImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      const response = await fetch(`/api/admin/resources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          location,
          image,
          mapImage,
          color: color || null,
          categoryId: categoryId || null,
          minBookingMinutes: limitDuration ? parseInt(minBookingMinutes) : null,
          maxBookingMinutes: limitDuration ? parseInt(maxBookingMinutes) : null,
          requiresApproval,
          advanceBookingDays: limitAdvanceBooking ? parseInt(advanceBookingDays) : null,
          showOnPublicCalendar,
          allowWholeBooking,
          prisInfo: visPrisInfo ? prisInfo : null,
          visPrisInfo,
          // Pricing fields (kun hvis aktivert)
          ...(pricingEnabled && {
            pricingRules: JSON.stringify(pricingRules.map(r => ({
              forRoles: r.forRoles,
              model: r.model,
              pricePerHour: r.pricePerHour ? parseFloat(r.pricePerHour) : null,
              pricePerDay: r.pricePerDay ? parseFloat(r.pricePerDay) : null,
              fixedPrice: r.fixedPrice ? parseFloat(r.fixedPrice) : null,
              fixedPriceDuration: r.fixedPriceDuration ? parseInt(r.fixedPriceDuration) : null
            })))
          }),
          parts: parts.filter(p => p.name.trim()).map(p => ({
            id: p.id,
            tempId: p.tempId,
            name: p.name,
            description: p.description || null,
            capacity: p.capacity ? parseInt(p.capacity) : null,
            mapCoordinates: p.mapCoordinates || null,
            adminNote: p.adminNote || null,
            image: p.image || null,
            parentId: p.parentId || null
          }))
        })
      })

      if (!response.ok) {
        throw new Error("Kunne ikke oppdatere fasilitet")
      }

      // Reload data to reflect saved state
      const updatedResource = await fetch(`/api/admin/resources/${id}`).then(res => res.json())
      // Check for 0/9999 or null to determine if duration is limited
      const hasLimit = updatedResource.minBookingMinutes !== null && 
                       updatedResource.maxBookingMinutes !== null &&
                       updatedResource.minBookingMinutes !== 0 && 
                       updatedResource.maxBookingMinutes !== 9999
      setLimitDuration(hasLimit)
      setMinBookingMinutes(String(updatedResource.minBookingMinutes || 60))
      setMaxBookingMinutes(String(updatedResource.maxBookingMinutes || 240))
      setPrisInfo(updatedResource.prisInfo || "")
      setVisPrisInfo(updatedResource.visPrisInfo ?? false)
      setParts(updatedResource.parts?.map((p: { id: string; name: string; description?: string; capacity?: number; mapCoordinates?: string; adminNote?: string; image?: string; parentId?: string }) => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
        capacity: p.capacity ? String(p.capacity) : "",
        mapCoordinates: p.mapCoordinates || null,
        adminNote: p.adminNote || null,
        image: p.image || null,
        parentId: p.parentId || null
      })) || [])

      // Show success message
      setSuccessMessage("Endringene ble lagret!")
      setTimeout(() => setSuccessMessage(""), 3000)
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
              <h1 className="text-xl font-bold text-gray-900">Rediger fasilitet</h1>
              <p className="text-gray-500 text-sm">Oppdater informasjon om fasiliteten</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-700 text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {successMessage}
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

              {/* Custom color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Egen farge for kalender (valgfritt)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color || "#3b82f6"}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="input max-w-[150px]"
                    placeholder="#3b82f6"
                  />
                  {color && (
                    <button
                      type="button"
                      onClick={() => setColor("")}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Bruk kategorifarge
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Brukes for å skille fasiliteter i hovedkalenderen. Uten egen farge brukes kategorifargen.
                </p>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ImageIcon className="w-4 h-4 inline mr-1" />
                  Bilde av fasilitet
                </label>
                
                {image ? (
                  <div className="flex items-start gap-4">
                    <div className="relative w-40 h-24 rounded-xl overflow-hidden bg-gray-100">
                      <Image
                        src={image}
                        alt="Fasilitetsbilde"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-secondary text-sm py-2"
                      >
                        <Upload className="w-4 h-4" />
                        Bytt bilde
                      </button>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        Fjern bilde
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer text-center"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Klikk for å laste opp bilde</p>
                    <p className="text-xs text-gray-400 mt-1">PNG eller JPG (maks 1MB)</p>
                  </div>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Booking settings */}
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 border-b pb-2">Booking-innstillinger</h2>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="limitDuration"
                    checked={limitDuration}
                    onChange={(e) => setLimitDuration(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="limitDuration" className="text-sm font-medium text-gray-700">
                    Begrens varighet på bookinger
                  </label>
                </div>
                
                {limitDuration && (
                  <div className="ml-8 grid md:grid-cols-2 gap-4">
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
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="limitAdvanceBooking"
                    checked={limitAdvanceBooking}
                    onChange={(e) => setLimitAdvanceBooking(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="limitAdvanceBooking" className="text-sm font-medium text-gray-700">
                    Begrens hvor langt frem i tid man kan booke
                  </label>
                </div>
                
                {limitAdvanceBooking && (
                  <div className="ml-8">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maks antall dager frem
                    </label>
                    <input
                      type="number"
                      value={advanceBookingDays}
                      onChange={(e) => setAdvanceBookingDays(e.target.value)}
                      className="input max-w-[200px]"
                      min="1"
                    />
                  </div>
                )}
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

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="showOnPublicCalendar"
                  checked={showOnPublicCalendar}
                  onChange={(e) => setShowOnPublicCalendar(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="showOnPublicCalendar" className="text-sm text-gray-700">
                  Vis fasiliteten på offentlig kalender (forsiden)
                </label>
              </div>
            </div>

            {/* Price info */}
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 border-b pb-2">Prisinfo</h2>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="visPrisInfo"
                  checked={visPrisInfo}
                  onChange={(e) => setVisPrisInfo(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="visPrisInfo" className="text-sm font-medium text-gray-700">
                  Vis prisinfo på fasilitetssiden
                </label>
              </div>

              {visPrisInfo && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prisinformasjon
                  </label>
                  <textarea
                    value={prisInfo}
                    onChange={(e) => setPrisInfo(e.target.value)}
                    className="input min-h-[100px]"
                    placeholder="F.eks. 500 kr/time, 300 kr/time for medlemmer..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Denne informasjonen vises under "Booking-info" på fasilitetssiden
                  </p>
                </div>
              )}
            </div>

            {/* Pricing Configuration (kun hvis aktivert via lisensserver) */}
            {pricingEnabled && (
              <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center justify-between border-b pb-2">
                  <h2 className="font-semibold text-gray-900">Prislogikk</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setPricingRules([...pricingRules, {
                        forRoles: [],
                        model: "FREE"
                      }])
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Legg til pris-regel
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  Konfigurer automatisk prisberegning for bookinger. Du kan sette forskjellige priser for forskjellige roller.
                </p>
                
                {pricingRules.length === 0 && (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                    Ingen pris-regler satt. Klikk "Legg til pris-regel" for å begynne.
                  </div>
                )}

                {pricingRules.map((rule, index) => (
                  <div key={index} className="p-4 bg-white border border-gray-200 rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900">Regel {index + 1}</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setPricingRules(pricingRules.filter((_, i) => i !== index))
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Gjelder for roller
                      </label>
                      <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={rule.forRoles.includes("admin")}
                            onChange={(e) => {
                              const newRules = [...pricingRules]
                              if (e.target.checked) {
                                newRules[index].forRoles = [...newRules[index].forRoles, "admin"]
                              } else {
                                newRules[index].forRoles = newRules[index].forRoles.filter(r => r !== "admin")
                              }
                              setPricingRules(newRules)
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-700">Administrator</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={rule.forRoles.includes("user")}
                            onChange={(e) => {
                              const newRules = [...pricingRules]
                              if (e.target.checked) {
                                newRules[index].forRoles = [...newRules[index].forRoles, "user"]
                              } else {
                                newRules[index].forRoles = newRules[index].forRoles.filter(r => r !== "user")
                              }
                              setPricingRules(newRules)
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-700">Bruker</span>
                        </label>
                        {customRoles.map(role => (
                          <label key={role.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={rule.forRoles.includes(role.id)}
                              onChange={(e) => {
                                const newRules = [...pricingRules]
                                if (e.target.checked) {
                                  newRules[index].forRoles = [...newRules[index].forRoles, role.id]
                                } else {
                                  newRules[index].forRoles = newRules[index].forRoles.filter(r => r !== role.id)
                                }
                                setPricingRules(newRules)
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm text-gray-700">{role.name}</span>
                          </label>
                        ))}
                        {rule.forRoles.length === 0 && (
                          <p className="text-xs text-gray-500 italic">
                            Ingen roller valgt = standard for alle andre roller
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pris-modell
                      </label>
                      <select
                        value={rule.model}
                        onChange={(e) => {
                          const newRules = [...pricingRules]
                          newRules[index].model = e.target.value as typeof rule.model
                          setPricingRules(newRules)
                        }}
                        className="input"
                      >
                        <option value="FREE">Gratis</option>
                        <option value="HOURLY">Per time</option>
                        <option value="DAILY">Per døgn</option>
                        <option value="FIXED">Fast pris</option>
                        <option value="FIXED_DURATION">Fast pris (med varighet)</option>
                      </select>
                    </div>

                    {rule.model === "HOURLY" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pris per time (NOK)
                        </label>
                        <input
                          type="number"
                          value={rule.pricePerHour || ""}
                          onChange={(e) => {
                            const newRules = [...pricingRules]
                            newRules[index].pricePerHour = e.target.value
                            setPricingRules(newRules)
                          }}
                          className="input"
                          placeholder="500"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    )}

                    {rule.model === "DAILY" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pris per døgn (NOK)
                        </label>
                        <input
                          type="number"
                          value={rule.pricePerDay || ""}
                          onChange={(e) => {
                            const newRules = [...pricingRules]
                            newRules[index].pricePerDay = e.target.value
                            setPricingRules(newRules)
                          }}
                          className="input"
                          placeholder="2000"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    )}

                    {(rule.model === "FIXED" || rule.model === "FIXED_DURATION") && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Fast pris (NOK)
                          </label>
                          <input
                            type="number"
                            value={rule.fixedPrice || ""}
                            onChange={(e) => {
                              const newRules = [...pricingRules]
                              newRules[index].fixedPrice = e.target.value
                              setPricingRules(newRules)
                            }}
                            className="input"
                            placeholder="1000"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        {rule.model === "FIXED_DURATION" && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Varighet for fast pris (minutter)
                            </label>
                            <input
                              type="number"
                              value={rule.fixedPriceDuration || ""}
                              onChange={(e) => {
                                const newRules = [...pricingRules]
                                newRules[index].fixedPriceDuration = e.target.value
                                setPricingRules(newRules)
                              }}
                              className="input"
                              placeholder="120"
                              min="1"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Hvis booking er lengre enn denne varigheten, beregnes pris per time
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Parts - Hierarchical */}
            <div className="space-y-4">
              <h2 className="font-semibold text-gray-900 border-b pb-2">Deler som kan bookes</h2>
              
              <PartsHierarchyEditor
                parts={parts}
                onPartsChange={setParts}
              />

              {parts.length > 0 && (
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                  <input
                    type="checkbox"
                    id="allowWholeBooking"
                    checked={allowWholeBooking}
                    onChange={(e) => setAllowWholeBooking(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="allowWholeBooking" className="text-sm text-gray-700">
                    Tillat booking av hele fasiliteten (i tillegg til deler)
                  </label>
                </div>
              )}
            </div>

            {/* Map Editor */}
            {parts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Map className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold text-gray-900">Oversiktskart</h2>
                </div>
                
                {/* Check if any parts are unsaved (no id) */}
                {parts.some(p => !p.id) ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-800">
                      <strong>Tips:</strong> Lagre endringene først for å kunne markere delene på et oversiktskart.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">
                      Last opp et bilde av fasiliteten og marker hvor de ulike delene befinner seg.
                    </p>
                    <MapEditor
                      mapImage={mapImage}
                      parts={parts}
                      onMapImageChange={setMapImage}
                      onPartsUpdate={setParts}
                    />
                  </>
                )}
              </div>
            )}

            {/* Moderators */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                <h2 className="font-semibold text-gray-900">Moderatorer</h2>
              </div>
              
              <p className="text-sm text-gray-500">
                Moderatorer kan godkjenne og avslå bookinger for denne fasiliteten. De kan ikke opprette bookinger selv.
              </p>

              <div className="space-y-2">
                {moderators.map((mod) => (
                  <div key={mod.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{mod.user.name || "Uten navn"}</p>
                        <p className="text-xs text-gray-500">{mod.user.email}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/admin/resources/${id}/moderators?userId=${mod.user.id}`, {
                          method: "DELETE"
                        })
                        // Reload moderators
                        const updated = await fetch(`/api/admin/resources/${id}/moderators`).then(res => res.json())
                        setModerators(updated || [])
                        // Update available moderators
                        const users = await fetch("/api/admin/users").then(res => res.json())
                        const moderatorUserIds = (updated || []).map((m: any) => m.user.id)
                        const available = users.filter((u: any) => 
                          u.role === "moderator" && u.isApproved && !moderatorUserIds.includes(u.id)
                        )
                        setAvailableModerators(available)
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                {moderators.length === 0 && (
                  <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
                    Ingen moderatorer tildelt denne fasiliteten
                  </div>
                )}
              </div>

              {availableModerators.length > 0 && (
                <div>
                  {!showAddModerator ? (
                    <button
                      type="button"
                      onClick={() => setShowAddModerator(true)}
                      className="btn btn-secondary text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Legg til moderator
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        value={selectedModeratorId}
                        onChange={(e) => setSelectedModeratorId(e.target.value)}
                        className="input flex-1"
                      >
                        <option value="">Velg moderator...</option>
                        {availableModerators.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name || "Uten navn"} ({user.email})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedModeratorId) return
                          
                          await fetch(`/api/admin/resources/${id}/moderators`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: selectedModeratorId })
                          })
                          
                          // Reload moderators
                          const updated = await fetch(`/api/admin/resources/${id}/moderators`).then(res => res.json())
                          setModerators(updated || [])
                          
                          // Update available moderators
                          const users = await fetch("/api/admin/users").then(res => res.json())
                          const moderatorUserIds = (updated || []).map((m: any) => m.user.id)
                          const available = users.filter((u: any) => 
                            u.role === "moderator" && u.isApproved && !moderatorUserIds.includes(u.id)
                          )
                          setAvailableModerators(available)
                          
                          setShowAddModerator(false)
                          setSelectedModeratorId("")
                        }}
                        disabled={!selectedModeratorId}
                        className="btn btn-primary text-sm disabled:opacity-50"
                      >
                        Legg til
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddModerator(false)
                          setSelectedModeratorId("")
                        }}
                        className="btn btn-secondary text-sm"
                      >
                        Avbryt
                      </button>
                    </div>
                  )}
                </div>
              )}

              {availableModerators.length === 0 && moderators.length > 0 && (
                <p className="text-xs text-gray-500">
                  Alle tilgjengelige moderatorer er allerede tildelt denne fasiliteten.
                </p>
              )}

              {availableModerators.length === 0 && moderators.length === 0 && (
                <p className="text-xs text-gray-500">
                  Det finnes ingen brukere med moderator-rolle. Gå til <Link href="/admin/users" className="text-blue-600 hover:underline">Brukere</Link> for å opprette en moderator.
                </p>
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
                    Lagrer...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Lagre endringer
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

