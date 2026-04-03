import Image from "next/image";
import { prisma } from "@/lib/prisma";
import {
  approveDesignerForm,
  publishProductForm,
  rejectDesignerForm,
  rejectProductForm,
  revisionProductForm,
} from "@/app/actions/admin";

export default async function AdminDashboardPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    ordersCount,
    designersCount,
    usersCount,
    ordersThisMonth,
    pendingDesigners,
    pendingProducts,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.designerProfile.count({ where: { status: "APPROVED" } }),
    prisma.user.count(),
    prisma.order.findMany({
      where: { createdAt: { gte: startOfMonth } },
      include: { items: true },
    }),
    prisma.designerProfile.findMany({
      where: { status: "PENDING" },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({
      where: { status: "PENDING" },
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { designer: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        items: { include: { product: { include: { designer: true } } } },
      },
    }),
  ]);

  const salesMonthRub = ordersThisMonth.reduce(
    (s, o) => s + o.items.reduce((t, i) => t + i.priceRub * i.quantity, 0),
    0,
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Панель управления</h1>
        <p className="text-sm text-charcoal/50">За текущий месяц</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-card border border-black/5 bg-cream p-4">
          <p className="text-xs uppercase tracking-wide text-charcoal/50">Продажи за месяц</p>
          <p className="mt-2 text-2xl font-semibold">{salesMonthRub.toLocaleString("ru-RU")} ₽</p>
        </div>
        <div className="rounded-card border border-black/5 bg-cream p-4">
          <p className="text-xs uppercase tracking-wide text-charcoal/50">Всего заказов</p>
          <p className="mt-2 text-2xl font-semibold">{ordersCount}</p>
        </div>
        <div className="rounded-card border border-black/5 bg-cream p-4">
          <p className="text-xs uppercase tracking-wide text-charcoal/50">Активные дизайнеры</p>
          <p className="mt-2 text-2xl font-semibold">{designersCount}</p>
        </div>
        <div className="rounded-card border border-black/5 bg-cream p-4">
          <p className="text-xs uppercase tracking-wide text-charcoal/50">Пользователи</p>
          <p className="mt-2 text-2xl font-semibold">{usersCount}</p>
        </div>
      </div>

      <div className="rounded-card border border-black/5 bg-cream p-6">
        <p className="font-serif text-lg font-semibold text-charcoal">График продаж (схематично)</p>
        <div className="mt-4 h-40 rounded-lg bg-gradient-to-t from-terracotta/30 to-transparent" />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-serif text-xl font-semibold text-charcoal">Заявки дизайнеров</h2>
          <ul className="mt-4 space-y-3">
            {pendingDesigners.length === 0 && (
              <li className="text-sm text-charcoal/60">Нет заявок в ожидании.</li>
            )}
            {pendingDesigners.map((d) => (
              <li
                key={d.id}
                className="flex flex-col gap-2 rounded-lg border border-black/5 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{d.studioName}</p>
                  <p className="text-xs text-charcoal/50">{d.city}</p>
                </div>
                <div className="flex gap-2">
                  <form action={approveDesignerForm}>
                    <input type="hidden" name="designerId" value={d.id} />
                    <button
                      type="submit"
                      className="rounded-pill bg-terracotta px-3 py-1.5 text-xs font-semibold text-white hover:bg-terracotta-dark"
                    >
                      Одобрить
                    </button>
                  </form>
                  <form action={rejectDesignerForm}>
                    <input type="hidden" name="designerId" value={d.id} />
                    <button
                      type="submit"
                      className="rounded-pill border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-sand"
                    >
                      Отклонить
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-serif text-xl font-semibold text-charcoal">Товары на модерации</h2>
          <ul className="mt-4 space-y-4">
            {pendingProducts.length === 0 && (
              <li className="text-sm text-charcoal/60">Нет товаров на проверке.</li>
            )}
            {pendingProducts.map((p) => (
              <li key={p.id} className="flex gap-3 rounded-lg border border-black/5 bg-white p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-sand">
                  <Image src={p.imageUrl} alt={p.title} fill className="object-cover" sizes="64px" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-charcoal/50">{p.designer.studioName}</p>
                  <p className="text-xs font-semibold text-terracotta">{p.priceRub.toLocaleString("ru-RU")} ₽</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <form action={publishProductForm}>
                      <input type="hidden" name="productId" value={p.id} />
                      <button
                        type="submit"
                        className="rounded-pill bg-terracotta px-3 py-1 text-xs font-semibold text-white"
                      >
                        Опубликовать
                      </button>
                    </form>
                    <form action={revisionProductForm}>
                      <input type="hidden" name="productId" value={p.id} />
                      <button
                        type="submit"
                        className="rounded-pill border border-black/15 px-3 py-1 text-xs font-semibold"
                      >
                        На доработку
                      </button>
                    </form>
                    <form action={rejectProductForm}>
                      <input type="hidden" name="productId" value={p.id} />
                      <button type="submit" className="text-xs text-red-700 underline">
                        Отклонить
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-xl font-semibold text-charcoal">Последние заказы</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-charcoal/50">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Сумма</th>
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4">Дата</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((o) => (
                <tr key={o.id} className="border-b border-black/5">
                  <td className="py-2 pr-4 font-mono text-xs">{o.id.slice(0, 8)}…</td>
                  <td className="py-2 pr-4">
                    {o.items.reduce((s, i) => s + i.priceRub * i.quantity, 0).toLocaleString("ru-RU")} ₽
                  </td>
                  <td className="py-2 pr-4">{o.status}</td>
                  <td className="py-2 pr-4">{o.createdAt.toLocaleDateString("ru-RU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
