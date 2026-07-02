export const leadImportAcceptanceSamples = {
  "Valid test record": [
    {
      company: "TEST — Valid Web Form Business",
      businessPhone: "+15555550101",
      email: "lead-valid@example.com",
      originalSource: "WEB_FORM",
      intakeMethod: "MANUAL_ENTRY",
      sourceDetail: "Internal Lead MVP acceptance test",
    },
  ],
  "Protected referral": [
    {
      company: "TEST — Referral Business",
      businessPhone: "+15555550102",
      email: "lead-referral@example.com",
      originalSource: "REFERRAL",
      intakeMethod: "REFERRAL_ENTRY",
      referrerName: "TEST — Referring Partner",
      referrerType: "PARTNER",
    },
  ],
  "In-batch duplicate": [
    {
      company: "TEST — Duplicate Business",
      businessPhone: "+15555550103",
      email: "lead-duplicate@example.com",
      originalSource: "WEB_FORM",
      intakeMethod: "MANUAL_ENTRY",
      sourceDetail: "Internal duplicate test",
    },
    {
      company: "TEST — Duplicate Business",
      businessPhone: "+15555550103",
      email: "lead-duplicate@example.com",
      originalSource: "WEB_FORM",
      intakeMethod: "MANUAL_ENTRY",
      sourceDetail: "Internal duplicate test",
    },
  ],
  "Blocked Maps scrape": [
    {
      company: "TEST — Blocked Maps Import",
      businessPhone: "+15555550104",
      email: "lead-maps@example.com",
      originalSource: "GOOGLE_MAPS",
      intakeMethod: "SCRAPE_IMPORT",
    },
  ],
} as const;

export type LeadImportAcceptanceSample = keyof typeof leadImportAcceptanceSamples;
