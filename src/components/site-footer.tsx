import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-black/5 bg-charcoal text-cream">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <p className="font-serif text-xl font-semibold">Atelier Local</p>
            <p className="mt-2 text-sm text-cream/70">
              Витрина авторского декора от локальных мастерских и дизайнеров.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-cream/50">Разделы</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/catalog" className="hover:text-terracotta transition">
                  Каталог
                </Link>
              </li>
              <li>
                <Link href="/designers" className="hover:text-terracotta transition">
                  Дизайнеры
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-cream/50">Компания</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href="#about" className="hover:text-terracotta transition">
                  О нас
                </a>
              </li>
              <li>
                <a href="#contacts" className="hover:text-terracotta transition">
                  Контакты
                </a>
              </li>
            </ul>
          </div>
          <div id="contacts">
            <p className="text-sm font-semibold uppercase tracking-wide text-cream/50">Рассылка</p>
            <p className="mt-2 text-sm text-cream/70">Скидки и новинки от мастеров — раз в две недели.</p>
            <div className="mt-3 flex gap-2">
              <input
                type="email"
                placeholder="Ваш email"
                readOnly
                className="flex-1 rounded-pill border border-white/20 bg-white/10 px-4 py-2 text-sm outline-none placeholder:text-cream/40"
              />
              <button
                type="button"
                className="rounded-pill bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-dark"
              >
                Подписаться
              </button>
            </div>
          </div>
        </div>
        <p className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-cream/50">
          © {new Date().getFullYear()} Atelier Local. Учебный проект.
        </p>
      </div>
    </footer>
  );
}
