"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/Navbar"
import Link from "next/link"
import { 
  ArrowLeft,
  Plus,
  Users,
  Shield,
  User,
  Loader2,
  MoreVertical,
  Trash2,
  ShieldCheck,
  ShieldOff,
  Mail
} from "lucide-react"
import { format } from "date-fns"
import { nb } from "date-fns/locale"

interface UserData {
  id: string
  email: string
  name: string | null
  role: string
  phone: string | null
  createdAt: string
  _count: {
    bookings: number
  }
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<UserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  // New user form
  const [newEmail, setNewEmail] = useState("")
  const [newName, setNewName] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState("user")
  const [isAdding, setIsAdding] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user?.role !== "admin") {
      router.push("/")
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user?.role === "admin") {
      fetchUsers()
    }
  }, [session])

  const fetchUsers = async () => {
    const response = await fetch("/api/admin/users")
    const data = await response.json()
    setUsers(data)
    setIsLoading(false)
  }

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === "admin" ? "user" : "admin"
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole })
    })
    fetchUsers()
    setOpenMenu(null)
  }

  const deleteUser = async (userId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne brukeren? Alle bookinger vil også bli slettet.")) {
      return
    }
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" })
    fetchUsers()
    setOpenMenu(null)
  }

  const addUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsAdding(true)

    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        name: newName,
        password: newPassword,
        role: newRole
      })
    })

    setNewEmail("")
    setNewName("")
    setNewPassword("")
    setNewRole("user")
    setShowAddModal(false)
    setIsAdding(false)
    fetchUsers()
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

  const admins = users.filter(u => u.role === "admin")
  const regularUsers = users.filter(u => u.role === "user")

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Tilbake til dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Brukere</h1>
            <p className="text-gray-500">Administrer brukere og tilganger</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-5 h-5" />
            Legg til bruker
          </button>
        </div>

        {/* Admins */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Administratorer ({admins.length})
          </h2>
          <div className="space-y-3">
            {admins.map((user) => (
              <UserCard 
                key={user.id} 
                user={user} 
                currentUserId={session?.user?.id}
                openMenu={openMenu}
                setOpenMenu={setOpenMenu}
                onToggleRole={toggleRole}
                onDelete={deleteUser}
              />
            ))}
          </div>
        </section>

        {/* Regular users */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Brukere ({regularUsers.length})
          </h2>
          {regularUsers.length === 0 ? (
            <div className="card p-8 text-center">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Ingen vanlige brukere enda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {regularUsers.map((user) => (
                <UserCard 
                  key={user.id} 
                  user={user}
                  currentUserId={session?.user?.id}
                  openMenu={openMenu}
                  setOpenMenu={setOpenMenu}
                  onToggleRole={toggleRole}
                  onDelete={deleteUser}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-full max-w-md animate-fadeIn">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Legg til ny bruker</h2>
            <form onSubmit={addUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-post *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Navn</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passord *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="input"
                >
                  <option value="user">Bruker</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isAdding}
                  className="btn btn-primary flex-1"
                >
                  {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Legg til"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                >
                  Avbryt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UserCard({ 
  user, 
  currentUserId,
  openMenu, 
  setOpenMenu, 
  onToggleRole, 
  onDelete 
}: { 
  user: UserData
  currentUserId?: string
  openMenu: string | null
  setOpenMenu: (id: string | null) => void
  onToggleRole: (id: string, role: string) => void
  onDelete: (id: string) => void
}) {
  const isCurrentUser = user.id === currentUserId

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            user.role === "admin" ? "bg-purple-100" : "bg-blue-100"
          }`}>
            {user.role === "admin" ? (
              <Shield className="w-5 h-5 text-purple-600" />
            ) : (
              <User className="w-5 h-5 text-blue-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">{user.name || "Uten navn"}</p>
              {isCurrentUser && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  Deg
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {user.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-gray-500">{user._count.bookings} bookinger</p>
            <p className="text-xs text-gray-400">
              Registrert {format(new Date(user.createdAt), "d. MMM yyyy", { locale: nb })}
            </p>
          </div>

          {!isCurrentUser && (
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>

              {openMenu === user.id && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10 animate-fadeIn">
                  <button
                    onClick={() => onToggleRole(user.id, user.role)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
                  >
                    {user.role === "admin" ? (
                      <>
                        <ShieldOff className="w-4 h-4" />
                        Fjern admin-tilgang
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Gjør til admin
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => onDelete(user.id)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                  >
                    <Trash2 className="w-4 h-4" />
                    Slett bruker
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

