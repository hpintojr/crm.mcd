type StatusItem = {
  label: string;
  value: string;
  detail?: string;
};

export function AdminOnboardingStatus({ items }: { items: StatusItem[] }) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div className="rounded-lg border border-ink-700 bg-ink-950/60 px-3 py-2" key={item.label}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{item.label}</p>
          <p className="mt-1 text-sm font-medium text-gray-100">{item.value}</p>
          {item.detail && <p className="mt-1 text-xs text-gray-500">{item.detail}</p>}
        </div>
      ))}
    </div>
  );
}
