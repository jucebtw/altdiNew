import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCartIdForRead } from "@/lib/cart-queries";
import { checkoutAction } from "@/app/actions/cart";
import { CartControls } from "@/components/cart-controls";
import { auth } from "@/auth";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const cartId = await getCartIdForRead();

  const items = cartId
    ? await prisma.cartItem.findMany({
        where: { cartId },
        include: { product: { include: { designer: true } } },
        orderBy: { id: "asc" },
      })
    : [];

  const subtotal = items.reduce((s, it) => s + it.product.priceRub * it.quantity, 0);
  const deliveryRub = subtotal >= 15000 || subtotal === 0 ? 0 : 750;
  const total = subtotal + deliveryRub;

  const rec = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      ...(items.length > 0 ? { id: { notIn: items.map((i) => i.productId) } } : {}),
    },
    take: 4,
    include: { designer: true },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-sm text-charcoal/50">
        <Link href="/" className="hover:text-terracotta">
          Главная
        </Link>{" "}
        / Корзина
      </p>
      <h1 className="mt-4 font-serif text-4xl font-semibold text-charcoal">Корзина</h1>

      {sp.success === "1" && (
        <div className="mt-6 rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          Заказ оформлен. Спасибо за поддержку локальных мастеров.
        </div>
      )}
      {sp.error && (
        <div className="mt-6 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {sp.error === "empty"
            ? "Корзина пуста."
            : decodeURIComponent(sp.error)}
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {items.length === 0 ? (
            <p className="text-charcoal/60">Корзина пуста. Загляните в каталог.</p>
          ) : (
            items.map((it) => (
              <div
                key={it.id}
                className="flex gap-4 rounded-card border border-black/5 bg-white p-4 shadow-soft"
              >
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-sand">
                  <Image src={it.product.imageUrl} alt={it.product.title} fill className="object-cover" sizes="112px" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-lg font-semibold text-charcoal">{it.product.title}</h2>
                  <p className="text-sm text-charcoal/50">{it.product.designer.studioName}</p>
                  <p className="mt-1 font-semibold text-terracotta">
                    {it.product.priceRub.toLocaleString("ru-RU")} ₽
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-pill bg-sand px-2 py-0.5 text-[10px] font-medium">Ручная работа</span>
                    <span className="rounded-pill bg-sand px-2 py-0.5 text-[10px] font-medium">Местный бренд</span>
                  </div>
                  <div className="mt-3">
                    <CartControls itemId={it.id} quantity={it.quantity} max={it.product.stock} />
                  </div>
                </div>
              </div>
            ))
          )}

          {rec.length > 0 && (
            <div className="pt-8">
              <h2 className="font-serif text-xl font-semibold text-charcoal">Рекомендуем вместе</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {rec.map((p) => (
                  <Link
                    key={p.id}
                    href="/catalog"
                    className="flex gap-3 rounded-card border border-black/5 bg-white p-3 shadow-soft"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-sand">
                      <Image src={p.imageUrl} alt={p.title} fill className="object-cover" sizes="80px" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-charcoal">{p.title}</p>
                      <p className="text-xs text-charcoal/50">{p.designer.studioName}</p>
                      <p className="text-sm font-semibold text-terracotta">{p.priceRub.toLocaleString("ru-RU")} ₽</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="sticky top-24 rounded-card border border-black/5 bg-white p-6 shadow-soft">
            <h2 className="font-serif text-xl font-semibold text-charcoal">Детали заказа</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-charcoal/60">Товары ({items.length})</span>
                <span>{subtotal.toLocaleString("ru-RU")} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-charcoal/60">Доставка</span>
                <span>{deliveryRub === 0 ? "Бесплатно" : `${deliveryRub.toLocaleString("ru-RU")} ₽`}</span>
              </div>
              <div className="border-t border-black/5 pt-3 text-lg font-semibold">
                <div className="flex justify-between">
                  <span>К оплате</span>
                  <span>{total.toLocaleString("ru-RU")} ₽</span>
                </div>
              </div>
            </div>
            {!session && (
              <p className="mt-4 text-xs text-charcoal/50">Для оформления войдите или создайте аккаунт покупателя.</p>
            )}
            <form action={checkoutAction} className="mt-6">
              <button
                type="submit"
                disabled={items.length === 0}
                className="w-full rounded-pill bg-terracotta py-3 text-sm font-semibold text-white hover:bg-terracotta-dark disabled:opacity-40"
              >
                Оформить заказ
              </button>
            </form>
            <p className="mt-4 text-xs text-charcoal/50">
              Оплата картами (демо). Безопасная среда, поддержка авторов.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
