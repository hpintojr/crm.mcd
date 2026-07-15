export const AGENT_ACTIVATION_STATES = [
  "APPLICANT_IN_REVIEW",
  "DOCUMENTS_IN_PROGRESS",
  "DOCUMENTS_COMPLETE",
  "W9_VERIFIED",
  "PROFILE_COMPLETE",
  "TRAINING_COMPLETE",
  "ACTIVE_PARTNER",
] as const;

export type AgentActivationState = (typeof AGENT_ACTIVATION_STATES)[number];

export const AGENT_ACTIVATION_GATES = ["W9_VERIFICATION", "PROFILE_COMPLETION", "TRAINING_COMPLETION"] as const;

export type AgentActivationGate = (typeof AGENT_ACTIVATION_GATES)[number];

export type AgentActivationInput = {
  agentApproved: boolean;
  documentsComplete: boolean;
  agreementCountersigned: boolean;
  w9Verified: boolean;
  profileComplete: boolean;
  trainingComplete: boolean;
  provisioned: boolean;
};

export type AgentActivationResult = {
  state: AgentActivationState;
  /**
   * True only when every documented business gate holds: approved applicant,
   * four completed documents with a countersigned Sales Agreement, and the
   * three admin-recorded internal gates (W-9 verification, profile
   * completeness, training/check-in). Document webhooks alone never satisfy
   * this policy.
   */
  mayIssueActivation: boolean;
  missingInternalGates: AgentActivationGate[];
};

function result(state: AgentActivationState, mayIssueActivation: boolean, missingInternalGates: AgentActivationGate[]): AgentActivationResult {
  return { state, mayIssueActivation, missingInternalGates };
}

/**
 * Derives the agent activation state from recorded evidence. The state is
 * computed, never stored, so it cannot drift from its underlying proof.
 * Agents provisioned before these gates existed are grandfathered: the policy
 * reports ACTIVE_PARTNER and never asks for a second activation issue.
 */
export function evaluateAgentActivation(input: AgentActivationInput): AgentActivationResult {
  const missing: AgentActivationGate[] = [];
  if (!input.w9Verified) missing.push("W9_VERIFICATION");
  if (!input.profileComplete) missing.push("PROFILE_COMPLETION");
  if (!input.trainingComplete) missing.push("TRAINING_COMPLETION");

  if (input.provisioned) return result("ACTIVE_PARTNER", false, missing);
  if (!input.agentApproved) return result("APPLICANT_IN_REVIEW", false, missing);
  if (!input.documentsComplete || !input.agreementCountersigned) return result("DOCUMENTS_IN_PROGRESS", false, missing);
  if (!input.w9Verified) return result("DOCUMENTS_COMPLETE", false, missing);
  if (!input.profileComplete) return result("W9_VERIFIED", false, missing);
  if (!input.trainingComplete) return result("PROFILE_COMPLETE", false, missing);
  return result("TRAINING_COMPLETE", true, missing);
}
