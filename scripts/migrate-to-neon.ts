/**
 * Migration script: Supabase → Neon
 * 
 * This script exports all data from the source database and imports it to the target.
 * 
 * Usage:
 *   $env:SOURCE_DB="postgresql://..." (Supabase)
 *   $env:TARGET_DB="postgresql://..." (Neon)
 *   npx tsx scripts/migrate-to-neon.ts
 */

import { PrismaClient } from '@prisma/client'

const SOURCE_URL = process.env.SOURCE_DB || ""
const TARGET_URL = process.env.TARGET_DB || ""

if (!SOURCE_URL || !TARGET_URL) {
  console.error(`
❌ Missing environment variables!

Set these before running:
  $env:SOURCE_DB="postgresql://..." (your Supabase URL)
  $env:TARGET_DB="postgresql://..." (your Neon URL)

Then run:
  npx tsx scripts/migrate-to-neon.ts
`)
  process.exit(1)
}

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              Database Migration: Supabase → Neon                  ║
╚══════════════════════════════════════════════════════════════════╝
`)

const sourceDb = new PrismaClient({
  datasources: { db: { url: SOURCE_URL } }
})

const targetDb = new PrismaClient({
  datasources: { db: { url: TARGET_URL } }
})

async function migrate() {
  try {
    console.log("📤 Eksporterer fra Supabase...")
    
    // Export all data
    const organizations = await sourceDb.organization.findMany()
    console.log(`   - ${organizations.length} organisasjoner`)
    
    const users = await sourceDb.user.findMany()
    console.log(`   - ${users.length} brukere`)
    
    const userPreferences = await sourceDb.userPreferences.findMany()
    console.log(`   - ${userPreferences.length} brukerpreferanser`)
    
    const categories = await sourceDb.resourceCategory.findMany()
    console.log(`   - ${categories.length} kategorier`)
    
    const resources = await sourceDb.resource.findMany()
    console.log(`   - ${resources.length} fasiliteter`)
    
    const resourceParts = await sourceDb.resourcePart.findMany()
    console.log(`   - ${resourceParts.length} fasilitetsdeler`)
    
    const bookings = await sourceDb.booking.findMany()
    console.log(`   - ${bookings.length} bookinger`)
    
    const emailTemplates = await sourceDb.emailTemplate.findMany()
    console.log(`   - ${emailTemplates.length} e-postmaler`)

    console.log("\n📥 Importerer til Neon...")
    
    // Import in correct order (respecting foreign keys)
    
    // 1. Organizations
    for (const org of organizations) {
      await targetDb.organization.upsert({
        where: { id: org.id },
        create: org,
        update: org
      })
    }
    console.log(`   ✓ Organisasjoner importert`)
    
    // 2. Users
    for (const user of users) {
      await targetDb.user.upsert({
        where: { id: user.id },
        create: user,
        update: user
      })
    }
    console.log(`   ✓ Brukere importert`)
    
    // 3. User Preferences
    for (const pref of userPreferences) {
      await targetDb.userPreferences.upsert({
        where: { id: pref.id },
        create: pref,
        update: pref
      })
    }
    console.log(`   ✓ Brukerpreferanser importert`)
    
    // 4. Categories
    for (const cat of categories) {
      await targetDb.resourceCategory.upsert({
        where: { id: cat.id },
        create: cat,
        update: cat
      })
    }
    console.log(`   ✓ Kategorier importert`)
    
    // 5. Resources
    for (const res of resources) {
      await targetDb.resource.upsert({
        where: { id: res.id },
        create: res,
        update: res
      })
    }
    console.log(`   ✓ Fasiliteter importert`)
    
    // 6. Resource Parts - må importeres i riktig rekkefølge (foreldre først)
    // Først de uten parent
    const partsWithoutParent = resourceParts.filter(p => !p.parentId)
    const partsWithParent = resourceParts.filter(p => p.parentId)
    
    for (const part of partsWithoutParent) {
      await targetDb.resourcePart.upsert({
        where: { id: part.id },
        create: part,
        update: part
      })
    }
    
    // Så de med parent
    for (const part of partsWithParent) {
      await targetDb.resourcePart.upsert({
        where: { id: part.id },
        create: part,
        update: part
      })
    }
    console.log(`   ✓ Fasilitetsdeler importert`)
    
    // 7. Bookings
    for (const booking of bookings) {
      await targetDb.booking.upsert({
        where: { id: booking.id },
        create: booking,
        update: booking
      })
    }
    console.log(`   ✓ Bookinger importert`)
    
    // 8. Email Templates
    for (const template of emailTemplates) {
      await targetDb.emailTemplate.upsert({
        where: { id: template.id },
        create: template,
        update: template
      })
    }
    console.log(`   ✓ E-postmaler importert`)

    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    ✅ Migrering fullført!                         ║
╚══════════════════════════════════════════════════════════════════╝

Neste steg:
1. Oppdater DATABASE_URL i Vercel til Neon URL
2. Redeploy prosjektet
3. Test at alt fungerer

`)

  } catch (error) {
    console.error("\n❌ Feil under migrering:", error)
    throw error
  } finally {
    await sourceDb.$disconnect()
    await targetDb.$disconnect()
  }
}

migrate()

