"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductStatus } from "@prisma/client";

async function requireSeller() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (session.user.role !== "SELLER" && session.user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  const designer = await prisma.designerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!designer) throw new Error("Нет профиля мастера");
  return { session, designer };
}

export async function createProductAction(formData: FormData) {
  const { designer } = await requireSeller();

  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const description = String(formData.get("description") ?? "").trim();
  const priceRub = Number(formData.get("priceRub"));
  const stock = Number(formData.get("stock"));
  const categoryId = String(formData.get("categoryId") ?? "");
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const materials = String(formData.get("materials") ?? "").trim() || null;
  const dimensions = String(formData.get("dimensions") ?? "").trim() || null;

  if (!title || !slug || !description || !categoryId || !imageUrl) {
    return { error: "Заполните обязательные поля" };
  }
  if (!Number.isFinite(priceRub) || priceRub < 1) return { error: "Цена некорректна" };
  if (!Number.isFinite(stock) || stock < 0) return { error: "Остаток некорректен" };

  try {
    await prisma.product.create({
      data: {
        designerId: designer.id,
        categoryId,
        title,
        slug,
        description,
        priceRub: Math.round(priceRub),
        stock: Math.round(stock),
        imageUrl,
        materials,
        dimensions,
        status: ProductStatus.PENDING,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return { error: "Такой slug уже занят — укажите другой" };
    }
    return { error: "Не удалось сохранить товар" };
  }

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/seller/dashboard");
  return { ok: true };
}

export async function updateProductStatusSeller(productId: string, status: ProductStatus) {
  const { designer } = await requireSeller();
  const p = await prisma.product.findFirst({
    where: { id: productId, designerId: designer.id },
  });
  if (!p) return { error: "Товар не найден" };

  await prisma.product.update({
    where: { id: productId },
    data: { status },
  });
  revalidatePath("/seller/dashboard");
  return { ok: true };
}
