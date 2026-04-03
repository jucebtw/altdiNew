import Link from "next/link";
import { auth } from "@/auth";
import { ButtonLink } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";
import { CartLink } from "@/components/cart-link";

const nav = [
  { href: "/catalog", label: "Каталог" },
  { href: "/designers", label: "Дизайнеры" },
  { href: "/#collections", label: "Коллекции" },
  { href: "/#about", label: "О нас" },
  { href: "/#contacts", label: "Контакты" },
];

export async function SiteHeader() {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <header className="border-b border-black/5 bg-cream/90 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-serif text-2xl font-semibold tracking-tight text-charcoal">
          Atelier Local
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-charcoal/80">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-terracotta transition">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {role === "SELLER" && (
            <ButtonLink href="/seller/dashboard" variant="ghost" className="!px-3 text-sm">
              Кабинет
            </ButtonLink>
          )}
          {role === "ADMIN" && (
            <ButtonLink href="/admin/dashboard" variant="ghost" className="!px-3 text-sm">
              Админ
            </ButtonLink>
          )}
          {session ? (
            <SignOutButton />
          ) : (
            <ButtonLink href="/login" variant="outline" className="!px-4 !py-2 text-sm">
              Войти
            </ButtonLink>
          )}
          <CartLink />
        </div>
      </div>
    </header>
  );
}
