import type { ReactNode } from "react";

type PortalFeaturePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PortalFeaturePage({ eyebrow, title, description, children }: PortalFeaturePageProps) {
  return (
    <div className="space-y-7">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-brand-400">{eyebrow}</p>
        <h1 className="portal-heading mt-2 text-3xl font-semibold">{title}</h1>
        <p className="portal-subheading mt-2 max-w-2xl">{description}</p>
      </section>
      {children}
    </div>
  );
}
