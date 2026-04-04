import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductStatus } from "@prisma/client";
import { EditProductForm } from "@/components/edit-product-form";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/seller/products/${id}/edit`);
  if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") redirect("/");

  const designer = await prisma.designerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!designer) {
    return <p className="text-charcoal/60">Нет профиля мастерской.</p>;
  }

  const product = await prisma.product.findFirst({
    where: { id, designerId: designer.id },
  });
  if (!product) notFound();
  if (product.status !== ProductStatus.DRAFT && product.status !== ProductStatus.REJECTED) {
    return (
      <div className="max-w-xl space-y-4">
        <p className="text-charcoal/80">
          Этот товар нельзя редактировать в текущем статусе. Доступно только для позиций на доработке или
          отклонённых администратором.
        </p>
        <Link href="/seller/dashboard" className="text-sm font-semibold text-terracotta hover:underline">
          ← В кабинет
        </Link>
      </div>
    );
  }

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-3xl font-semibold text-charcoal">Редактирование товара</h1>
      <p className="mt-2 text-sm text-charcoal/60">
        После сохранения карточка снова отправится на модерацию.
      </p>
      <div className="mt-8">
        <EditProductForm
          product={{
            id: product.id,
            title: product.title,
            slug: product.slug,
            categoryId: product.categoryId,
            description: product.description,
            priceRub: product.priceRub,
            stock: product.stock,
            imageUrl: product.imageUrl,
            materials: product.materials,
            dimensions: product.dimensions,
          }}
          categories={categories}
        />
      </div>
    </div>
  );
}
