import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      systemRole: "admin" | "user"
      customRoleId: string | null
      customRoleName: string | null
      hasModeratorAccess: boolean
      role: string // Legacy: systemRole eller customRoleName
      emailVerified: boolean
      isMember: boolean
      organizationId: string
      organizationName: string
      organizationSlug: string
      organizationTagline: string
      organizationColor: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    systemRole: "admin" | "user"
    customRoleId: string | null
    customRoleName: string | null
    hasModeratorAccess: boolean
    role: string // Legacy
    emailVerified: boolean
    isMember: boolean
    organizationId: string
    organizationName: string
    organizationSlug: string
    organizationTagline: string
    organizationColor: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    systemRole: "admin" | "user"
    customRoleId: string | null
    customRoleName: string | null
    hasModeratorAccess: boolean
    role: string // Legacy
    emailVerified: boolean
    isMember: boolean
    organizationId: string
    organizationName: string
    organizationSlug: string
    organizationTagline: string
    organizationColor: string
  }
}
