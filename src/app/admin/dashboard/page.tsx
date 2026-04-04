import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { approveDesignerForm, rejectDesignerForm } from "@/app/actions/admin";

export default async function AdminDashboardPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    ordersCount,
    designersCount,
    usersCount,
    ordersThisMonth,
    pendingDesigners,
    pendingProductsCount,
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
    prisma.product.count({ where: { status: "PENDING" } }),
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

        <div className="flex flex-col justify-between rounded-lg border border-black/5 bg-white p-5">
          <div>
            <h2 className="font-serif text-xl font-semibold text-charcoal">Модерация товаров</h2>
            <p className="mt-2 text-sm text-charcoal/60">
              {pendingProductsCount === 0
                ? "Нет товаров в очереди на проверку."
                : `В очереди: ${pendingProductsCount} шт.`}
            </p>
          </div>
          <Link
            href="/admin/moderation"
            className="mt-4 inline-flex w-fit rounded-pill bg-terracotta px-4 py-2 text-sm font-semibold text-white hover:bg-terracotta-dark"
          >
            Открыть очередь модерации
          </Link>
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
