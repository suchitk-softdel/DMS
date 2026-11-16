import { prisma } from '../db/prisma.js'

// Sales opportunities for one dealer (SRS 3.8). Win probability, briefs and
// bundle recommendations are AI-layer results and will be added separately.
export async function listOpportunities(dealerId, { stage }) {
  const rows = await prisma.opportunity.findMany({
    where: { dealerId, ...(stage && { stage }) },
    orderBy: { decisionDate: 'asc' },
    include: { customer: { select: { id: true, name: true, type: true, city: true } } },
  })
  return rows.map(({ dealerId: _d, customerId: _c, ...row }) => row)
}
