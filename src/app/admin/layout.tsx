import Link from "next/link";

const nav = [
  { href: "/admin/dashboard", label: "Панель управления" },
  { href: "/catalog", label: "Витрина" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto flex max-w-7xl gap-0 md:gap-8 md:px-4 md:py-8">
        <aside className="hidden w-56 shrink-0 flex-col rounded-card border border-black/5 bg-white p-5 shadow-soft md:flex">
          <p className="font-serif text-lg font-semibold text-charcoal">Atelier Local</p>
          <p className="text-xs text-charcoal/50">Администрирование</p>
          <nav className="mt-6 flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-charcoal/80 hover:bg-sand"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1 p-4 md:rounded-card md:border md:border-black/5 md:bg-white md:p-8 md:shadow-soft">
          {children}
        </div>
      </div>
    </div>
  );
}
