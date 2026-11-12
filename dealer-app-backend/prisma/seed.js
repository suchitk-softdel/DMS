// Loads ~3 years of generated demo data into the database.
// Run with: npm run db:seed   (options: --seed 42 --years 3 --end 2026-11-12)
//
// Wipes all existing rows first, so it is safe to run again at any time.

import { parseArgs } from 'node:util'
import { MODULES } from '../src/constants/domain.js'
import { prisma } from '../src/db/prisma.js'
import { hashPassword } from '../src/utils/password.js'
import { generateData } from './seed/generate.js'

const { values: args } = parseArgs({
  options: {
    seed: { type: 'string', default: '42' },
    years: { type: 'string', default: '3' },
    end: { type: 'string' }, // YYYY-MM-DD, defaults to today
  },
})

// Roles = dealer user classes from SRS 2.3. Module access is a working
// assumption until the RBAC matrix is confirmed (SRS 8.2).
const ROLES = [
  {
    id: 'principal',
    name: 'Dealer Principal',
    permissions: Object.values(MODULES),
  },
  {
    id: 'salesRep',
    name: 'Sales Representative',
    permissions: [MODULES.HOME, MODULES.ORDERS, MODULES.INVENTORY, MODULES.INCENTIVES, MODULES.SALES_COACH],
  },
  {
    id: 'technician',
    name: 'Service Technician',
    permissions: [MODULES.HOME, MODULES.WARRANTY, MODULES.INCENTIVES],
  },
]

// Demo accounts, all with password demo123. principal2 belongs to another
// dealership so data isolation between dealers can be tested.
const DEMO_PASSWORD = 'demo123'
const USERS = [
  { id: 'u-002', name: 'Demo Principal', email: 'principal@demo.com', roleId: 'principal', dealerId: 'd-1001' },
  { id: 'u-003', name: 'Demo Sales Rep', email: 'sales@demo.com', roleId: 'salesRep', dealerId: 'd-1001' },
  { id: 'u-004', name: 'Demo Technician', email: 'tech@demo.com', roleId: 'technician', dealerId: 'd-1001' },
  { id: 'u-006', name: 'Coastal Principal', email: 'principal2@demo.com', roleId: 'principal', dealerId: 'd-1002' },
]

const CHUNK_SIZE = 500

async function insertMany(model, rows) {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await model.createMany({ data: rows.slice(i, i + CHUNK_SIZE) })
  }
  return rows.length
}

async function wipe() {
  // Children before parents so foreign keys are never violated.
  await prisma.auditLog.deleteMany()
  await prisma.trainingProgress.deleteMany()
  await prisma.incentiveProgress.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.sale.deleteMany()
  await prisma.inventory.deleteMany()
  await prisma.claim.deleteMany()
  await prisma.warrantyRegistration.deleteMany()
  await prisma.opportunity.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.user.deleteMany()
  await prisma.role.deleteMany()
  await prisma.dealer.deleteMany()
  await prisma.product.deleteMany()
  await prisma.incentiveProgram.deleteMany()
  await prisma.trainingCourse.deleteMany()
}

async function main() {
  const endDate = args.end ? new Date(`${args.end}T00:00:00Z`) : new Date()
  if (Number.isNaN(endDate.getTime())) throw new Error('--end must look like YYYY-MM-DD')

  const started = Date.now()
  const data = generateData({ seed: Number(args.seed), years: Number(args.years), endDate })
  const fmt = (d) => d.toISOString().slice(0, 10)
  console.log(`Generating data from ${fmt(data.range.start)} to ${fmt(data.range.end)} (seed ${args.seed})`)

  await wipe()

  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const users = USERS.map((user) => ({ ...user, passwordHash }))

  const counts = {
    dealers: await insertMany(prisma.dealer, data.dealers),
    roles: await insertMany(
      prisma.role,
      ROLES.map((role) => ({ ...role, permissions: JSON.stringify(role.permissions) })),
    ),
    users: await insertMany(prisma.user, users),
    products: await insertMany(prisma.product, data.products),
    customers: await insertMany(prisma.customer, data.customers),
    orders: await insertMany(prisma.order, data.orders),
    orderItems: await insertMany(prisma.orderItem, data.orderItems),
    sales: await insertMany(prisma.sale, data.sales),
    inventory: await insertMany(prisma.inventory, data.inventory),
    warrantyRegistrations: await insertMany(prisma.warrantyRegistration, data.registrations),
    claims: await insertMany(prisma.claim, data.claims),
    incentivePrograms: await insertMany(prisma.incentiveProgram, data.incentivePrograms),
    incentiveProgress: await insertMany(prisma.incentiveProgress, data.incentiveProgress),
    trainingCourses: await insertMany(prisma.trainingCourse, data.trainingCourses),
    trainingProgress: await insertMany(prisma.trainingProgress, data.buildTrainingProgress(users)),
    opportunities: await insertMany(prisma.opportunity, data.opportunities),
  }

  console.table(counts)
  console.log(`Seeded in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
