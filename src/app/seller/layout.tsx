import Link from "next/link";

const nav = [
  { href: "/seller/dashboard", label: "Обзор" },
  { href: "/seller/products/new", label: "Добавить товар" },
];

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F1E9]">
      <div className="mx-auto flex max-w-7xl gap-0 px-0 py-0 md:gap-8 md:px-4 md:py-8">
        <aside className="hidden w-64 shrink-0 flex-col rounded-card bg-sidebar-dark p-6 text-cream md:flex">
          <Link href="/" className="font-serif text-xl font-semibold text-cream">
            Atelier Local
          </Link>
          <p className="mt-1 text-xs text-cream/50">Личный кабинет продавца</p>
          <nav className="mt-8 flex flex-col gap-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-cream/80 hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/"
            className="mt-auto pt-8 text-sm text-cream/50 hover:text-cream"
          >
            ← На витрину
          </Link>
        </aside>
        <div className="min-w-0 flex-1 rounded-none bg-transparent p-4 md:rounded-card md:border md:border-black/5 md:bg-white md:p-8 md:shadow-soft">
          {children}
        </div>
      </div>
    </div>
  );
}
