/**
 * Dual-write Prisma wrapper
 * Skriver til både Supabase (primær) og Neon (backup) samtidig
 */

import { PrismaClient } from '@prisma/client'

// Supabase (primær database)
const supabasePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL, // Supabase
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
})

// Neon (backup database) - kun hvis BACKUP_DATABASE_URL er satt
let neonPrisma: PrismaClient | null = null
if (process.env.BACKUP_DATABASE_URL) {
  try {
    neonPrisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.BACKUP_DATABASE_URL, // Neon
        },
      },
      log: ['error'], // Kun errors for backup
    })
  } catch (error) {
    console.error('[Dual-Prisma] Failed to initialize Neon backup client:', error)
  }
}

/**
 * Dual-write wrapper
 * Skriver til primær database (Supabase) og backup (Neon) hvis tilgjengelig
 */
async function dualWrite<T>(
  operation: (prisma: PrismaClient) => Promise<T>,
  operationName: string
): Promise<T> {
  // Alltid skriv til primær database først
  const primaryResult = await operation(supabasePrisma)

  // Skriv til backup hvis tilgjengelig (async, ikke blokker)
  if (neonPrisma) {
    operation(neonPrisma).catch((error) => {
      // Logg feil, men ikke kast - backup-feil skal ikke påvirke applikasjonen
      console.error(`[Dual-Prisma] Backup write failed for ${operationName}:`, error.message)
    })
  }

  return primaryResult
}

/**
 * Dual-write wrapper for transaksjoner
 * Mer kompleks - skriver til begge, men hvis backup feiler, fortsetter vi
 */
async function dualWriteTransaction<T>(
  operation: (prisma: PrismaClient) => Promise<T>,
  operationName: string
): Promise<T> {
  // Primær transaksjon
  const primaryResult = await supabasePrisma.$transaction(async (tx) => {
    return await operation(tx as PrismaClient)
  })

  // Backup transaksjon (async, ikke blokker)
  if (neonPrisma) {
    neonPrisma
      .$transaction(async (tx) => {
        return await operation(tx as PrismaClient)
      })
      .catch((error) => {
        console.error(`[Dual-Prisma] Backup transaction failed for ${operationName}:`, error.message)
      })
  }

  return primaryResult
}

/**
 * Proxy wrapper for Prisma client
 * Automatisk dual-write for alle operasjoner
 */
export const prisma = new Proxy(supabasePrisma, {
  get(target, prop) {
    const original = target[prop as keyof PrismaClient]

    // Håndter spesielle metoder
    if (prop === '$transaction') {
      return async function (callback: any, options?: any) {
        if (typeof callback === 'function') {
          return dualWriteTransaction(
            (prisma) => callback(prisma),
            'transaction'
          )
        }
        // Hvis det er en array av operasjoner
        return original.apply(target, [callback, options])
      }
    }

    // For alle andre operasjoner, returner original hvis det ikke er en funksjon
    if (typeof original !== 'function') {
      return original
    }

    // For modeller (user, booking, etc.)
    if (typeof prop === 'string' && !prop.startsWith('$') && !prop.startsWith('_')) {
      const model = original as any
      return new Proxy(model, {
        get(modelTarget, modelProp) {
          const modelOriginal = modelTarget[modelProp as keyof typeof modelTarget]

          if (typeof modelOriginal !== 'function') {
            return modelOriginal
          }

          // Wrap alle CRUD-operasjoner
          return async function (...args: any[]) {
            const operationName = `${prop}.${String(modelProp)}`
            
            // For create, update, upsert, delete - bruk dual-write
            if (['create', 'update', 'upsert', 'delete', 'deleteMany', 'updateMany', 'createMany'].includes(String(modelProp))) {
              return dualWrite(
                (prisma) => modelOriginal.apply(modelTarget, args),
                operationName
              )
            }

            // For read-operasjoner (findMany, findUnique, etc.) - kun primær
            return modelOriginal.apply(modelTarget, args)
          }
        },
      })
    }

    // For $-metoder ($connect, $disconnect, etc.) - kun primær
    return original
  },
})

// Cleanup ved shutdown
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await supabasePrisma.$disconnect()
    if (neonPrisma) {
      await neonPrisma.$disconnect()
    }
  })
}

