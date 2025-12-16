import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import Link from "next/link"
import { 
  Building2, 
  Calendar, 
  Users, 
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  Clock
} from "lucide-react"
import { PendingBookingsList } from "@/components/PendingBookingsList"

async function getStats(organizationId: string, userId?: string, isModerator?: boolean) {
  // Get moderator's assigned resources if applicable
  let resourceIds: string[] | undefined
  if (isModerator && userId) {
    const moderatorResources = await prisma.resourceModerator.findMany({
      where: { userId },
      select: { resourceId: true }
    })
    resourceIds = moderatorResources.map(mr => mr.resourceId)
  }

  const [
    resourceCount,
    pendingBookings,
    approvedBookings,
    userCount
  ] = await Promise.all([
    isModerator && resourceIds 
      ? prisma.resource.count({ where: { organizationId, isActive: true, id: { in: resourceIds } } })
      : prisma.resource.count({ where: { organizationId, isActive: true } }),
    isModerator && resourceIds
      ? prisma.booking.count({ where: { organizationId, status: "pending", resourceId: { in: resourceIds } } })
      : prisma.booking.count({ where: { organizationId, status: "pending" } }),
    isModerator && resourceIds
      ? prisma.booking.count({ 
          where: { 
            organizationId, 
            status: "approved",
            startTime: { gte: new Date() },
            resourceId: { in: resourceIds }
          } 
        })
      : prisma.booking.count({ 
          where: { 
            organizationId, 
            status: "approved",
            startTime: { gte: new Date() }
          } 
        }),
    isModerator ? Promise.resolve(0) : prisma.user.count({ where: { organizationId } })
  ])

  return { resourceCount, pendingBookings, approvedBookings, userCount }
}

async function getPendingBookings(organizationId: string, userId?: string, isModerator?: boolean) {
  // Get moderator's assigned resources if applicable
  let resourceIds: string[] | undefined
  if (isModerator && userId) {
    const moderatorResources = await prisma.resourceModerator.findMany({
      where: { userId },
      select: { resourceId: true }
    })
    resourceIds = moderatorResources.map(mr => mr.resourceId)
    if (resourceIds.length === 0) {
      return []
    }
  }

  return prisma.booking.findMany({
    where: { 
      organizationId, 
      status: "pending",
      ...(isModerator && resourceIds ? { resourceId: { in: resourceIds } } : {})
    },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      createdAt: true,
      resource: {
        select: {
          id: true,
          name: true,
          color: true
        }
      },
      resourcePart: {
        select: {
          id: true,
          name: true
        }
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: "asc" },
    take: 5
  })
}

// Force dynamic rendering since we use getServerSession and database queries
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      redirect("/")
    }

    const isAdmin = session.user.role === "admin"
    const isModerator = session.user.role === "moderator"

    if (!isAdmin && !isModerator) {
      redirect("/")
    }

    if (!session.user.organizationId) {
      redirect("/")
    }

    const [stats, pendingBookings] = await Promise.all([
      getStats(session.user.organizationId, session.user.id, isModerator),
      getPendingBookings(session.user.organizationId, session.user.id, isModerator)
    ])

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {isModerator ? "Moderator Dashboard" : "Admin Dashboard"}
          </h1>
          <p className="text-gray-500">{session.user.organizationName}</p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Fasiliteter</p>
                <p className="text-3xl font-bold text-gray-900">{stats.resourceCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Venter på godkjenning</p>
                <p className="text-3xl font-bold text-amber-600">{stats.pendingBookings}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Kommende bookinger</p>
                <p className="text-3xl font-bold text-green-600">{stats.approvedBookings}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Brukere</p>
                <p className="text-3xl font-bold text-gray-900">{stats.userCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Quick actions */}
          {isAdmin && (
            <div className="lg:col-span-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Hurtiglenker</h2>
              <div className="space-y-3">
                <Link 
                  href="/admin/bookings" 
                  className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Behandle bookinger</p>
                      <p className="text-sm text-gray-500">{stats.pendingBookings} venter</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </Link>
                <Link 
                  href="/admin/resources" 
                  className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Administrer fasiliteter</p>
                      <p className="text-sm text-gray-500">{stats.resourceCount} aktive</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </Link>
                <Link 
                  href="/admin/categories" 
                  className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Kategorier</p>
                      <p className="text-sm text-gray-500">Organiser fasiliteter</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </Link>
                <Link 
                  href="/admin/users" 
                  className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Brukere</p>
                      <p className="text-sm text-gray-500">{stats.userCount} registrert</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </Link>
                <Link 
                  href="/admin/settings" 
                  className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Innstillinger</p>
                      <p className="text-sm text-gray-500">Klubb og utseende</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </Link>
              </div>
            </div>
          )}

          {/* Pending bookings */}
          <div className={isAdmin ? "lg:col-span-2" : "lg:col-span-3"}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Ventende bookinger</h2>
              {stats.pendingBookings > 0 && (
                <Link href="/admin/bookings" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Se alle →
                </Link>
              )}
            </div>
            
            <PendingBookingsList 
              bookings={pendingBookings.map(b => ({
                id: b.id,
                title: b.title,
                resourceName: b.resource.name,
                resourcePartName: b.resourcePart?.name || null,
                userName: b.user.name || b.user.email,
                startTime: (b.startTime instanceof Date ? b.startTime : new Date(b.startTime)).toISOString(),
                endTime: (b.endTime instanceof Date ? b.endTime : new Date(b.endTime)).toISOString()
              }))}
            />
          </div>
        </div>
        </div>
      </main>
      <Footer />
    </div>
    )
  } catch (error) {
    console.error("Admin page error:", error)
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Feil oppstod</h1>
            <p className="text-gray-500">Kunne ikke laste admin dashboard. Prøv å oppdatere siden.</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }
}

