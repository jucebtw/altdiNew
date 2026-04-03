import Link from "next/link";
import { getCartItemCount } from "@/lib/cart-queries";

export async function CartLink() {
  const count = await getCartItemCount();
  return (
    <Link
      href="/cart"
      className="inline-flex items-center justify-center gap-2 rounded-pill bg-terracotta px-4 py-2 text-sm font-medium text-white shadow-soft transition hover:bg-terracotta-dark"
    >
      <span aria-hidden>🛒</span>
      Корзина{count > 0 ? ` (${count})` : ""}
    </Link>
  );
}
