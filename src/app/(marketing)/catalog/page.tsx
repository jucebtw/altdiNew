import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductGridClient } from "@/components/product-grid-client";
import type { ProductModalData } from "@/components/product-modal";

type Props = { searchParams: Promise<{ category?: string }> };

export default async function CatalogPage({ searchParams }: Props) {
  const sp = await searchParams;
  const categorySlug = sp.category;

  const [categories, products] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: {
        status: "PUBLISHED",
        ...(categorySlug
          ? { category: { slug: categorySlug } }
          : {}),
      },
      orderBy: { title: "asc" },
      include: { designer: true, category: true },
    }),
  ]);

  const modalProducts: ProductModalData[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    priceRub: p.priceRub,
    description: p.description,
    materials: p.materials,
    dimensions: p.dimensions,
    stock: p.stock,
    imageUrl: p.imageUrl,
    designer: { studioName: p.designer.studioName, slug: p.designer.slug },
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold text-charcoal">Каталог</h1>
      <p className="mt-2 text-charcoal/60">Фильтр по категориям и быстрый просмотр карточки.</p>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/catalog"
          className={`rounded-pill px-4 py-2 text-sm font-medium ${
            !categorySlug ? "bg-terracotta text-white" : "bg-sand text-charcoal hover:bg-sand/80"
          }`}
        >
          Все
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/catalog?category=${c.slug}`}
            className={`rounded-pill px-4 py-2 text-sm font-medium ${
              categorySlug === c.slug
                ? "bg-terracotta text-white"
                : "bg-sand text-charcoal hover:bg-sand/80"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mt-10">
        {products.length === 0 ? (
          <p className="text-charcoal/60">В этой категории пока нет товаров.</p>
        ) : (
          <ProductGridClient products={modalProducts} />
        )}
      </div>
    </div>
  );
}
