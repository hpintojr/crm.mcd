import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const schema = z.object({
  leadId: z.string().cuid(),
  packageCode: z.string().trim().min(1).max(120),
});

type ExistingAccount = { id: string };

export async function createClientAccountFromWonLead(input: z.input<typeof schema>) {
  requireFeature("leads");
  requireFeature("servicing");
  const actor = await requireRole(ADMIN_ROLES);
  const parsed = schema.parse(input);
  const lead = await db.lead.findUnique({ where: { id: parsed.leadId } });
  if (!lead) throw new Error("Lead not found.");
  if (lead.lifecycle !== "CLOSED_WON") throw new Error("Only closed-won leads can become client accounts.");
  if (lead.dnc || lead.suppressed) throw new Error("Suppressed leads cannot become client accounts.");

  const existing = await db.$queryRaw<ExistingAccount[]>`
    SELECT "id" FROM "ClientAccount" WHERE "leadId" = ${lead.id} LIMIT 1
  `;
  if (existing[0]) return { clientAccountId: existing[0].id, alreadyCreated: true };

  const clientAccountId = randomUUID();
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "ClientAccount" ("id", "leadId", "clientName", "ghlContactId", "packageCode", "accountOwnerAgentId", "originatingAgentId", "createdAt", "updatedAt")
      VALUES (${clientAccountId}, ${lead.id}, ${lead.company}, ${lead.ghlContactId}, ${parsed.packageCode}, ${lead.ownerAgentId}, ${lead.ownerAgentId}, ${now}, ${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "ClientServiceActivity" ("id", "clientAccountId", "agentId", "type", "notes", "occurredAt", "createdAt")
      VALUES (${randomUUID()}, ${clientAccountId}, ${lead.ownerAgentId}, 'ACCOUNT_CREATED'::"ClientServiceActivityType", 'Created from a closed-won Lead.', ${now}, ${now})
    `;
    await tx.$executeRaw`
      INSERT INTO "AuditLog" ("id", "actorUserId", "actorRole", "actionType", "entityType", "entityId", "metadata", "createdAt")
      VALUES (${randomUUID()}, ${actor.id}, ${actor.role}, 'CLIENT_ACCOUNT_CREATED_FROM_WON_LEAD', 'ClientAccount', ${clientAccountId}, ${JSON.stringify({ leadId: lead.id, packageCode: parsed.packageCode })}::jsonb, ${now})
    `;
  });

  return { clientAccountId, alreadyCreated: false };
}
