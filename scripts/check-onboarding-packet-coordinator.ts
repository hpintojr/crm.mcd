import { strict as assert } from "node:assert";
import { onboardingPacketEmail } from "../src/lib/emails/onboarding-packet-email";
import { resolveDispatchDecision, type DocumentSendResult } from "../src/lib/onboarding-packet-dispatch-policy";

// Synthetic-data proof for the Option B onboarding packet coordinator. No live GHL API
// call and no live SMTP send happens anywhere in this script — every input is fabricated.
// This proves the composition and fail-closed dispatch logic; it does NOT prove the GHL
// Send Template response field mapping in src/lib/ghl-documents.ts, which needs a real
// (but still non-applicant) API call to verify. See docs/ONBOARDING_PACKET_COORDINATOR.md.

const DOC_TYPES = ["SALES_AGREEMENT", "NDA_IP", "W9_PAYOUT", "ACKNOWLEDGMENT"] as const;

function ok(documentType: (typeof DOC_TYPES)[number]): DocumentSendResult {
  return { documentType, ok: true, ghlDocumentId: `doc_${documentType}`, signingUrl: `https://sign.example/${documentType}` };
}
function fail(documentType: (typeof DOC_TYPES)[number], error: string): DocumentSendResult {
  return { documentType, ok: false, error };
}

// 1. All four succeed -> sends email, all 4 links preserved in the original order.
const allOk = DOC_TYPES.map((type) => ok(type));
const decisionAllOk = resolveDispatchDecision(allOk);
assert.equal(decisionAllOk.sendEmail, true, "all four successes should send the email");
if (decisionAllOk.sendEmail) {
  assert.equal(decisionAllOk.links.length, 4, "all 4 links must be present");
  assert.deepEqual(
    decisionAllOk.links.map((link) => link.documentType),
    [...DOC_TYPES],
    "link order must match dispatch order",
  );
}

// 2. Exactly one failure among four -> fails closed, no partial links, correct failure identified.
const oneFail = DOC_TYPES.map((type, i) => (i === 2 ? fail(type, "GHL 500") : ok(type)));
const decisionOneFail = resolveDispatchDecision(oneFail);
assert.equal(decisionOneFail.sendEmail, false, "any single failure must fail closed (no partial email)");
if (!decisionOneFail.sendEmail) {
  assert.equal(decisionOneFail.failures.length, 1, "exactly one failure must be captured");
  assert.equal(decisionOneFail.failures[0].documentType, "W9_PAYOUT", "the correct failing document must be identified");
}

// 3. All four fail -> fails closed with all four failures captured.
const allFail = DOC_TYPES.map((type) => fail(type, "GHL down"));
const decisionAllFail = resolveDispatchDecision(allFail);
assert.equal(decisionAllFail.sendEmail, false);
if (!decisionAllFail.sendEmail) assert.equal(decisionAllFail.failures.length, 4, "all four failures must be captured");

// 4. Email composition requires exactly four links.
assert.throws(
  () => onboardingPacketEmail({ recipientName: "Test Agent", links: [{ label: "A", url: "https://x/1" }] }),
  /requires exactly 4 links/,
  "composing an email with anything but exactly 4 links must throw",
);

// 5. Email composition contains all four links exactly once, with the recipient name escaped in HTML.
const links = [
  { label: "Sales Partner Agreement", url: "https://sign.example/sales" },
  { label: "Confidentiality and IP Agreement", url: "https://sign.example/nda" },
  { label: "W-9 / Payout Intake", url: "https://sign.example/w9" },
  { label: "New Hire Acknowledgment", url: "https://sign.example/ack" },
];
const email = onboardingPacketEmail({ recipientName: "Synthetic Agent <script>alert(1)</script>", links });
assert.equal(email.subject.includes("4 documents"), true, "subject must reference all four documents");
for (const link of links) {
  assert.equal(email.text.includes(link.url), true, `plain text must include ${link.url}`);
  assert.equal(email.html.includes(link.url), true, `html must include ${link.url}`);
  assert.equal(email.text.split(link.url).length - 1, 1, `${link.url} must appear exactly once in the plain-text body`);
}
assert.equal(email.html.includes("<script>"), false, "recipient name must be HTML-escaped in the html body");
assert.equal(
  email.text.includes("Synthetic Agent <script>alert(1)</script>"),
  true,
  "plain-text body is not HTML and is expected to carry the raw name unescaped",
);

console.log(
  "Onboarding packet coordinator: composition and fail-closed dispatch policy checks passed with synthetic data (zero live GHL/SMTP calls).",
);
