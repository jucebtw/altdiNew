import { prisma } from "@/lib/prisma";
import { AdminProductModerationList } from "@/components/admin-product-moderation-list";

export default async function AdminModerationPage() {
  const pendingProducts = await prisma.product.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { designer: true },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-charcoal">Модерация товаров</h1>
        <p className="mt-2 text-sm text-charcoal/60">
          Очередь на проверку: сначала старые заявки. После решения карточка исчезнет из списка.
        </p>
      </div>

      <div className="rounded-card border border-black/5 bg-cream p-6">
        <p className="text-sm text-charcoal/70">
          В очереди:{" "}
          <span className="font-semibold text-charcoal">{pendingProducts.length}</span>
        </p>
        <div className="mt-6">
          <AdminProductModerationList products={pendingProducts} />
        </div>
      </div>
    </div>
  );
}
