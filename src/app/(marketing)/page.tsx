import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { ButtonLink } from "@/components/ui/button";
import { ProductGridClient } from "@/components/product-grid-client";
import type { ProductModalData } from "@/components/product-modal";

export default async function HomePage() {
  const [products, designers, categories] = await Promise.all([
    prisma.product.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { designer: true },
    }),
    prisma.designerProfile.findMany({
      where: { status: "APPROVED" },
      take: 3,
    }),
    prisma.category.findMany(),
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

  const catImages: Record<string, string> = {
    ceramics: "https://images.unsplash.com/photo-1610701596007-1150874949bb?w=600&h=600&fit=crop",
    lighting: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=600&fit=crop",
    textiles: "https://images.unsplash.com/photo-1584100936595-c65d5c6c0c4c?w=600&h=600&fit=crop",
    "wall-decor": "https://images.unsplash.com/photo-1513519245088-0e12902e5a01?w=600&h=600&fit=crop",
  };

  return (
    <>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-terracotta">Локальные мастера</p>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-charcoal md:text-5xl text-balance">
            Авторский декор для дома от дизайнеров и мастерских
          </h1>
          <p className="mt-4 text-lg text-charcoal/70">
            Уникальные предметы интерьера ручной работы — керамика, свет, текстиль и настенный декор в одной витрине.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/catalog">Смотреть каталог</ButtonLink>
            <ButtonLink href="/login?callbackUrl=/seller/dashboard" variant="outline">
              Стать продавцом
            </ButtonLink>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-sand shadow-soft">
          <Image
            src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&h=900&fit=crop"
            alt="Интерьер"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      </section>

      <section id="collections" className="border-y border-black/5 bg-white/60 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-serif text-3xl font-semibold text-charcoal">Категории</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/catalog?category=${c.slug}`}
                className="group relative aspect-[4/3] overflow-hidden rounded-card bg-sand shadow-soft"
              >
                <Image
                  src={catImages[c.slug] ?? catImages.ceramics}
                  alt={c.name}
                  fill
                  className="object-cover transition group-hover:scale-105"
                  sizes="25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 to-transparent" />
                <p className="absolute bottom-4 left-4 font-serif text-xl text-white">{c.name}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl font-semibold text-charcoal">Новинки каталога</h2>
            <p className="mt-2 text-charcoal/60">Подборка свежих работ мастеров.</p>
          </div>
          <Link href="/catalog" className="text-sm font-medium text-terracotta hover:underline">
            Весь каталог
          </Link>
        </div>
        <div className="mt-10">
          <ProductGridClient products={modalProducts} />
        </div>
      </section>

      <section className="border-t border-black/5 bg-sand/50 py-16" id="about">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-serif text-3xl font-semibold text-charcoal">Наши дизайнеры</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {designers.map((d) => (
              <Link
                key={d.id}
                href={`/designers/${d.slug}`}
                className="rounded-card border border-black/5 bg-white p-6 shadow-soft transition hover:shadow-modal"
              >
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-full bg-sand">
                    {d.avatarUrl && (
                      <Image src={d.avatarUrl} alt={d.studioName} fill className="object-cover" sizes="64px" />
                    )}
                  </div>
                  <div>
                    <p className="font-serif text-lg font-semibold">{d.studioName}</p>
                    <p className="text-sm text-charcoal/60">{d.city}</p>
                  </div>
                </div>
                <p className="mt-4 line-clamp-3 text-sm text-charcoal/70">{d.bio}</p>
                <span className="mt-4 inline-block text-sm font-medium text-terracotta">Перейти к профилю →</span>
              </Link>
            ))}
          </div>
          <div className="mt-8 text-center">
            <ButtonLink href="/designers" variant="outline">
              Все дизайнеры
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 rounded-card border border-black/5 bg-white p-8 shadow-soft md:grid-cols-4">
          {[
            { t: "Быстрая доставка", d: "По России от 3 дней" },
            { t: "Безопасная оплата", d: "Карты и СБП" },
            { t: "Ручная работа", d: "Уникальные экземпляры" },
            { t: "Локальные авторы", d: "Поддержка мастеров" },
          ].map((x) => (
            <div key={x.t}>
              <p className="font-serif text-lg font-semibold text-charcoal">{x.t}</p>
              <p className="mt-1 text-sm text-charcoal/60">{x.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
