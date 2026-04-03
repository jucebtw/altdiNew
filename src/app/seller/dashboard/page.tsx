import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductStatusBadge } from "@/components/product-status-badge";

export default async function SellerDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/seller/dashboard");
  if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") {
    redirect("/");
  }

  const designer = await prisma.designerProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      products: { orderBy: { updatedAt: "desc" } },
    },
  });

  if (!designer) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-semibold text-charcoal">Кабинет продавца</h1>
        <p className="mt-2 text-charcoal/60">
          У вашей учётной записи нет профиля мастерской. Обратитесь к администратору платформы.
        </p>
      </div>
    );
  }

  const orderItems = await prisma.orderItem.findMany({
    where: { product: { designerId: designer.id } },
  });
  const revenueTotal = orderItems.reduce((s, i) => s + i.priceRub * i.quantity, 0);

  const orders = await prisma.order.findMany({
    where: {
      items: { some: { product: { designerId: designer.id } } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      items: {
        where: { product: { designerId: designer.id } },
        include: { product: true },
      },
    },
  });

  const views = designer.products.reduce((s, p) => s + p.stock + 100, 0);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-charcoal">
            Рады вас видеть, {designer.studioName}!
          </h1>
          <p className="text-sm text-charcoal/60">Управление товарами и заказами.</p>
        </div>
        <Link
          href="/seller/products/new"
          className="inline-flex justify-center rounded-pill bg-terracotta px-5 py-2.5 text-sm font-semibold text-white hover:bg-terracotta-dark"
        >
          Добавить новый товар
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-card border border-black/5 bg-cream p-4">
          <p className="text-xs uppercase tracking-wide text-charcoal/50">Выручка (все время)</p>
          <p className="mt-2 text-2xl font-semibold">
            {revenueTotal.toLocaleString("ru-RU")} ₽
          </p>
        </div>
        <div className="rounded-card border border-black/5 bg-cream p-4">
          <p className="text-xs uppercase tracking-wide text-charcoal/50">Активных товаров</p>
          <p className="mt-2 text-2xl font-semibold">{designer.products.length}</p>
        </div>
        <div className="rounded-card border border-black/5 bg-cream p-4">
          <p className="text-xs uppercase tracking-wide text-charcoal/50">Условные просмотры</p>
          <p className="mt-2 text-2xl font-semibold">{views.toLocaleString("ru-RU")}</p>
        </div>
        <div className="rounded-card border border-black/5 bg-cream p-4">
          <p className="text-xs uppercase tracking-wide text-charcoal/50">Заказов (показано)</p>
          <p className="mt-2 text-2xl font-semibold">{orders.length}</p>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-xl font-semibold text-charcoal">Мои товары</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-charcoal/50">
                <th className="py-2 pr-4">Товар</th>
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4">Цена</th>
                <th className="py-2 pr-4">Остаток</th>
              </tr>
            </thead>
            <tbody>
              {designer.products.map((p) => (
                <tr key={p.id} className="border-b border-black/5">
                  <td className="py-3 pr-4 font-medium">{p.title}</td>
                  <td className="py-3 pr-4">
                    <ProductStatusBadge status={p.status} />
                  </td>
                  <td className="py-3 pr-4">{p.priceRub.toLocaleString("ru-RU")} ₽</td>
                  <td className="py-3 pr-4">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-xl font-semibold text-charcoal">Последние заказы</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {orders.length === 0 && <li className="text-charcoal/60">Пока нет заказов с вашими товарами.</li>}
          {orders.map((o) => (
            <li key={o.id} className="flex justify-between rounded-lg border border-black/5 bg-cream px-4 py-3">
              <span className="font-medium">Заказ {o.id.slice(0, 8)}…</span>
              <span className="text-charcoal/60">{o.createdAt.toLocaleDateString("ru-RU")}</span>
              <span>
                {o.items.reduce((s, i) => s + i.priceRub * i.quantity, 0).toLocaleString("ru-RU")} ₽
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
