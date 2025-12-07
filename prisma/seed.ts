import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Check if categories already exist
  const existingCategories = await prisma.resourceCategory.findFirst()
  if (existingCategories) {
    console.log('⚠️  Categories already exist. Skipping...')
    return
  }

  // Create default resource categories (useful for all organizations)
  await prisma.resourceCategory.createMany({
    data: [
      { name: 'Utendørs', description: 'Utendørs fasiliteter', icon: 'Sun', color: '#22c55e' },
      { name: 'Innendørs', description: 'Innendørs fasiliteter', icon: 'Home', color: '#3b82f6' },
      { name: 'Møterom', description: 'Møterom og sosiale rom', icon: 'Users', color: '#f59e0b' },
      { name: 'Utstyr', description: 'Utstyr som kan lånes', icon: 'Package', color: '#8b5cf6' }
    ]
  })

  console.log('✅ Default categories created!')
  console.log('')
  console.log('🚀 Ready for production!')
  console.log('   Users can now register at /register')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
