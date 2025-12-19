import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { validateLicense } from "./license"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

          // Use select instead of include to avoid relation validation issues
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              role: true,
              isApproved: true,
              emailVerified: true,
              isMember: true,
              organizationId: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  tagline: true,
                  primaryColor: true
                }
              }
            }
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // Check if user is approved (admins and organization creators are always approved)
        if (!user.isApproved && user.role !== "admin") {
          throw new Error("Din konto venter på godkjenning fra administrator")
        }

          if (!user.organization) {
            console.error("User has no organization:", user.id)
            return null
          }

        // Sjekk lisens ved hver innlogging (testfase)
        // Admin får alltid logge inn for å kunne konfigurere lisens
        if (user.role !== "admin") {
          try {
            const license = await validateLicense(true) // Force refresh
            if (!license.valid) {
              const errorMsg = license.status === "expired" 
                ? "Abonnementet har utløpt. Kontakt din klubb for mer informasjon."
                : license.status === "suspended"
                  ? "Lisensen er suspendert. Kontakt din klubb."
                  : "Tjenesten er midlertidig utilgjengelig. Kontakt din klubb."
              throw new Error(errorMsg)
            }
          } catch (licenseError) {
            // Hvis lisenssjekk feiler, kast feilen videre
            if (licenseError instanceof Error) {
              throw licenseError
            }
            throw new Error("Kunne ikke verifisere lisens. Kontakt din klubb.")
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: Boolean(user.emailVerified),
          isMember: Boolean(user.isMember),
          organizationId: user.organizationId,
          organizationName: user.organization.name,
          organizationSlug: user.organization.slug,
            organizationTagline: user.organization.tagline || "Kalender",
          organizationColor: user.organization.primaryColor,
          }
        } catch (error) {
          // Re-throw specific error messages so they show to the user
          if (error instanceof Error) {
            // Lisensfeil og godkjenningsfeil skal vises direkte
            if (
              error.message.includes("godkjenning") || 
              error.message.includes("utilgjengelig") ||
              error.message.includes("utløpt") ||
              error.message.includes("suspendert") ||
              error.message.includes("lisens")
            ) {
              throw error
            }
          }
          // Log other errors but show generic message
          console.error("Auth error:", error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.emailVerified = Boolean(user.emailVerified)
        token.isMember = Boolean(user.isMember)
        token.organizationId = user.organizationId
        token.organizationName = user.organizationName
        token.organizationSlug = user.organizationSlug
        token.organizationTagline = user.organizationTagline
        token.organizationColor = user.organizationColor
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.emailVerified = token.emailVerified as boolean
        session.user.isMember = token.isMember as boolean
        session.user.organizationId = token.organizationId as string
        session.user.organizationName = token.organizationName as string
        session.user.organizationSlug = token.organizationSlug as string
        session.user.organizationTagline = token.organizationTagline as string
        session.user.organizationColor = token.organizationColor as string
      }
      return session
    }
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
}

