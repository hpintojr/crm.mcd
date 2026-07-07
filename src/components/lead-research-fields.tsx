type LeadResearchData = {
  businessAddress: string | null;
  googleRating: { toString(): string } | null;
  googleRatingObservedAt: Date | null;
  googleMapsUrl: string | null;
};

function pacific(value: Date | null) {
  return value
    ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })
    : "Not recorded";
}

/**
 * Displays only authorized Lead data supplied by the calling page. The Maps URL
 * is an outbound manual-research link; this component never fetches, embeds,
 * or renders Maps content or reviews.
 */
export function LeadResearchFields({ research }: { research: LeadResearchData }) {
  return (
    <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
      <h2 className="font-semibold text-white">Sales research</h2>
      <p className="mt-2 text-sm text-gray-400">Provider-supplied reference data. Ratings may have changed since the observed date; open Maps manually before discussing reviews.</p>
      <dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
        <div><dt className="text-gray-500">Business address</dt><dd className="mt-1 text-gray-200">{research.businessAddress || "—"}</dd></div>
        <div><dt className="text-gray-500">Google rating</dt><dd className="mt-1 text-gray-200">{research.googleRating ? `${research.googleRating.toString()} / 5` : "—"}</dd></div>
        <div><dt className="text-gray-500">Rating observed</dt><dd className="mt-1 text-gray-200">{pacific(research.googleRatingObservedAt)} PT</dd></div>
        <div><dt className="text-gray-500">Google Maps</dt><dd className="mt-1">{research.googleMapsUrl ? <a className="text-brand-300 hover:text-brand-200" href={research.googleMapsUrl} target="_blank" rel="noreferrer">Open public listing</a> : <span className="text-gray-200">—</span>}</dd></div>
      </dl>
    </article>
  );
}
