import { Navbar } from "./Navbar"
import { Footer } from "./Footer"
import { LicenseWarningBanner } from "./LicenseWarningBanner"

interface PageLayoutProps {
  children: React.ReactNode
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <LicenseWarningBanner />
      <Navbar />
      
      <main className="flex-1">
        {children}
      </main>
      
      <Footer />
    </div>
  )
}
