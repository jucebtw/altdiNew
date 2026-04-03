import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NewProductForm } from "@/components/new-product-form";

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/seller/products/new");
  if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") redirect("/");

  const designer = await prisma.designerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!designer) {
    return <p className="text-charcoal/60">Нет профиля мастерской.</p>;
  }

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-3xl font-semibold text-charcoal">Новый товар</h1>
      <p className="mt-2 text-sm text-charcoal/60">
        После сохранения товар попадёт на модерацию администратору.
      </p>
      <div className="mt-8">
        <NewProductForm categories={categories} />
      </div>
    </div>
  );
}
