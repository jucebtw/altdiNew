import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductGridClient } from "@/components/product-grid-client";
import type { ProductModalData } from "@/components/product-modal";

type Props = { params: Promise<{ slug: string }> };

export default async function DesignerProfilePage({ params }: Props) {
  const { slug } = await params;
  const designer = await prisma.designerProfile.findUnique({
    where: { slug },
    include: {
      products: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!designer || designer.status !== "APPROVED") notFound();

  const modalProducts: ProductModalData[] = designer.products.map((p) => ({
    id: p.id,
    title: p.title,
    priceRub: p.priceRub,
    description: p.description,
    materials: p.materials,
    dimensions: p.dimensions,
    stock: p.stock,
    imageUrl: p.imageUrl,
    designer: { studioName: designer.studioName, slug: designer.slug },
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="rounded-card border border-black/5 bg-white p-8 shadow-soft">
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <div className="relative mx-auto h-36 w-36 shrink-0 overflow-hidden rounded-full bg-sand ring-4 ring-terracotta/20 md:mx-0">
            {designer.avatarUrl && (
              <Image src={designer.avatarUrl} alt={designer.studioName} fill className="object-cover" sizes="144px" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="font-serif text-4xl font-semibold text-charcoal">{designer.studioName}</h1>
            <p className="mt-1 text-charcoal/60">
              {designer.city} · {designer.specialty}
            </p>
            <p className="mt-4 max-w-2xl text-charcoal/80">{designer.bio}</p>
            <div className="mt-6 flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-charcoal/50">Подписчики</p>
                <p className="text-lg font-semibold">{designer.followerCount}</p>
              </div>
              <div>
                <p className="text-charcoal/50">Рейтинг</p>
                <p className="text-lg font-semibold">
                  {designer.ratingAvg.toFixed(1)} ({designer.reviewCount} отзывов)
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <Link
                href="#products"
                className="inline-flex rounded-pill bg-terracotta px-5 py-2.5 text-sm font-medium text-white hover:bg-terracotta-dark"
              >
                Смотреть товары
              </Link>
              <span className="text-sm text-charcoal/50">Instagram · Telegram (демо)</span>
            </div>
          </div>
        </div>
      </div>

      <div id="products" className="mt-12">
        <h2 className="font-serif text-2xl font-semibold text-charcoal">Товары</h2>
        <div className="mt-6">
          {modalProducts.length === 0 ? (
            <p className="text-charcoal/60">Пока нет опубликованных товаров.</p>
          ) : (
            <ProductGridClient products={modalProducts} />
          )}
        </div>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="rounded-card border border-black/5 bg-sand/50 p-6">
          <h3 className="font-serif text-xl font-semibold">Отзывы</h3>
          <p className="mt-2 text-sm text-charcoal/70">
            «Невероятное качество керамики, упаковка бережная.» — Екатерина К.
          </p>
        </div>
        <div className="rounded-card border border-black/5 bg-sand/50 p-6">
          <h3 className="font-serif text-xl font-semibold">Мастерская</h3>
          <div className="relative mt-3 aspect-[2/1] overflow-hidden rounded-card bg-sand">
            <Image
              src="https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&h=400&fit=crop"
              alt="Процесс"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
