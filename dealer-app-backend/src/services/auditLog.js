import { prisma } from '../db/prisma.js'

// Records an action in the audit log (SRS 6.2: all write actions are logged).
// Keep personal data out of `details` (SRS 6.6).
export async function logAudit({ userId = null, action, entity = null, entityId = null, details = null }) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity,
      entityId,
      details: details ? JSON.stringify(details) : null,
    },
  })
}
