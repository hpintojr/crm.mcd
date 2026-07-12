import "server-only";

export function expectedControlledGhlTestFailure(error: unknown): { error: string; status: number } | null {
  if (!(error instanceof Error)) return null;

  switch (error.message) {
    case "Unsupported controlled GHL test event type.":
    case "Choose an appointment event type for the appointment harness.":
    case "Choose an opportunity event type for the opportunity harness.":
      return { error: "Invalid controlled test event type.", status: 422 };
    case "Controlled test Lead not found.":
      return { error: "Controlled test Lead not found.", status: 404 };
    case "The GHL test harness only accepts controlled test Leads.":
      return { error: "This action is restricted to controlled test Leads.", status: 403 };
    case "Lead module is not enabled.":
      return { error: "Not found.", status: 404 };
    default:
      return null;
  }
}
