import "server-only";

import { z } from "zod";
import { PACKAGE_SCHEDULE } from "@/lib/package-schedule";

const codes = Object.keys(PACKAGE_SCHEDULE) as [keyof typeof PACKAGE_SCHEDULE, ...(keyof typeof PACKAGE_SCHEDULE)[]];

export const fundingRules = z.object({
  event_type: z.enum(["FUNDED", "FUNDING_FAILED", "REFUND", "DISPUTE"]),
  ghl_event_id: z.string().min(1),
  location_id: z.string().min(1),
  payment_ref: z.string().min(1),
  amount_collected: z.coerce.number().nonnegative(),
  processing_fee: z.coerce.number().nonnegative().default(0),
  tax_amount: z.coerce.number().nonnegative().default(0),
  package_code: z.enum(codes),
  currency: z.literal("USD").default("USD"),
  occurred_at: z.string().datetime(),
  mini_crm_agent_id: z.string().min(1).optional(),
  originating_agent_id: z.string().min(1).optional(),
  mini_crm_client_account_id: z.string().min(1).optional(),
}).passthrough();

export function toCents(value: number) { return Math.round(value * 100); }
