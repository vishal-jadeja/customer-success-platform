// Shared filter-bar chrome: both CustomerTable's inline filter bar and
// InteractionFilters render their controls inside this wrapper so the two
// filter bars (customer list, interaction list) look like one system rather
// than two independently-styled forms.
export default function Filters({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-hairline bg-panel p-4 backdrop-blur-xl">
      {children}
    </div>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
