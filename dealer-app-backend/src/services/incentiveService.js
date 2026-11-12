import { prisma } from '../db/prisma.js'

// Active incentive programs with this dealer's progress, next milestone and
// rank among peer dealers (FR-INC-1, FR-INC-2).
export async function listIncentives(dealerId) {
  const programs = await prisma.incentiveProgram.findMany({
    orderBy: { startDate: 'asc' },
    include: { progress: { select: { dealerId: true, current: true, earned: true } } },
  })

  return programs.map(({ progress, milestones, ...program }) => {
    const parsedMilestones = JSON.parse(milestones)
    const mine = progress.find((p) => p.dealerId === dealerId) ?? { current: 0, earned: 0 }
    const ranked = [...progress].sort((a, b) => b.current - a.current)
    const nextMilestone = parsedMilestones.find((m) => mine.current < m.target) ?? null

    return {
      ...program,
      milestones: parsedMilestones,
      current: mine.current,
      earned: mine.earned,
      nextMilestone,
      percentToNext: nextMilestone ? Math.min(100, Math.round((mine.current / nextMilestone.target) * 100)) : 100,
      peerRank: ranked.findIndex((p) => p.dealerId === dealerId) + 1 || null,
      peerCount: ranked.length,
    }
  })
}
