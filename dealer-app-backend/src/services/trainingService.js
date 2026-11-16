import { prisma } from '../db/prisma.js'

// Training courses with the signed-in user's progress, their certifications
// and upcoming live events (FR-INC-4, FR-INC-5).
export async function getTrainingOverview(userId) {
  const courses = await prisma.trainingCourse.findMany({
    orderBy: { id: 'asc' },
    include: { progress: { where: { userId }, select: { completionPct: true, completedAt: true } } },
  })

  const now = new Date()
  const withProgress = courses.map(({ progress, ...course }) => ({
    ...course,
    completionPct: progress[0]?.completionPct ?? 0,
    completedAt: progress[0]?.completedAt ?? null,
  }))

  return {
    courses: withProgress.filter((c) => !c.scheduledAt),
    upcomingEvents: withProgress
      .filter((c) => c.scheduledAt && c.scheduledAt >= now)
      .sort((a, b) => a.scheduledAt - b.scheduledAt),
    certifications: withProgress
      .filter((c) => c.certification && c.completionPct === 100)
      .map((c) => ({ name: c.certification, courseId: c.id, earnedAt: c.completedAt })),
  }
}
