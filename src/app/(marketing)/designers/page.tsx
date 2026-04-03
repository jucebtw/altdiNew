import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";

export default async function DesignersPage() {
  const designers = await prisma.designerProfile.findMany({
    where: { status: "APPROVED" },
    orderBy: { studioName: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-4xl font-semibold text-charcoal">Дизайнеры и мастерские</h1>
      <p className="mt-2 max-w-2xl text-charcoal/60">
        Локальные авторы, с которыми мы работаем. Каждый профиль — история материалов и ручного труда.
      </p>
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {designers.map((d) => (
          <Link
            key={d.id}
            href={`/designers/${d.slug}`}
            className="flex gap-6 rounded-card border border-black/5 bg-white p-6 shadow-soft transition hover:shadow-modal"
          >
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full bg-sand">
              {d.avatarUrl && (
                <Image src={d.avatarUrl} alt={d.studioName} fill className="object-cover" sizes="112px" />
              )}
            </div>
            <div>
              <h2 className="font-serif text-2xl font-semibold text-charcoal">{d.studioName}</h2>
              <p className="text-sm text-charcoal/50">
                {d.city} · {d.specialty}
              </p>
              <p className="mt-2 line-clamp-3 text-sm text-charcoal/70">{d.bio}</p>
              <p className="mt-3 text-sm font-medium text-terracotta">Открыть профиль →</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
