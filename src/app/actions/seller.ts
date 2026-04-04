"use server";

import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import { extname, join } from "path";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProductStatus } from "@prisma/client";

const PRODUCT_UPLOAD_PREFIX = "/uploads/products/";
const PRODUCT_UPLOAD_DIR = join(process.cwd(), "public", "uploads", "products");
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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

function getFileExtension(file: File) {
  const fromName = extname(file.name).toLowerCase();
  if (fromName) return fromName;
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "image/gif") return ".gif";
  return ".jpg";
}

async function deleteLocalProductImage(imageUrl: string | null | undefined) {
  if (!imageUrl?.startsWith(PRODUCT_UPLOAD_PREFIX)) return;

  try {
    await unlink(join(process.cwd(), "public", imageUrl.replace(/^\//, "")));
  } catch {
    // Nothing to do if the previous upload is already missing.
  }
}

async function saveUploadedProductImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { error: "Можно загружать только JPG, PNG, WEBP или GIF" };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { error: "Файл изображения должен быть не больше 5 МБ" };
  }

  await mkdir(PRODUCT_UPLOAD_DIR, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}${getFileExtension(file)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(join(PRODUCT_UPLOAD_DIR, filename), bytes);

  return { imageUrl: `${PRODUCT_UPLOAD_PREFIX}${filename}` };
}

async function resolveProductImage(
  formData: FormData,
  currentImageUrl?: string | null,
): Promise<{ imageUrl?: string; error?: string }> {
  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  const imageFile = formData.get("imageFile");

  if (imageFile instanceof File && imageFile.size > 0) {
    const saved = await saveUploadedProductImage(imageFile);
    if (saved.error) return saved;

    await deleteLocalProductImage(currentImageUrl);
    return saved;
  }

  if (imageUrl) {
    if (currentImageUrl && currentImageUrl !== imageUrl) {
      await deleteLocalProductImage(currentImageUrl);
    }
    return { imageUrl };
  }

  if (currentImageUrl) {
    return { imageUrl: currentImageUrl };
  }

  return { error: "Укажите ссылку на изображение или загрузите файл" };
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
  const materials = String(formData.get("materials") ?? "").trim() || null;
  const dimensions = String(formData.get("dimensions") ?? "").trim() || null;
  const resolvedImage = await resolveProductImage(formData);

  if (!title || !slug || !description || !categoryId) {
    return { error: "Заполните обязательные поля" };
  }
  if (resolvedImage.error || !resolvedImage.imageUrl) return { error: resolvedImage.error };
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
        imageUrl: resolvedImage.imageUrl,
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
  revalidatePath("/admin/moderation");
  return { ok: true };
}

export async function updateProductAction(formData: FormData) {
  const { designer } = await requireSeller();

  const productId = String(formData.get("productId") ?? "").trim();
  if (!productId) return { error: "Не указан товар" };

  const existing = await prisma.product.findFirst({
    where: { id: productId, designerId: designer.id },
  });
  if (!existing) return { error: "Товар не найден" };
  if (existing.status !== ProductStatus.DRAFT && existing.status !== ProductStatus.REJECTED) {
    return { error: "Редактирование доступно только для товаров на доработке или отклонённых" };
  }

  const title = String(formData.get("title") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const description = String(formData.get("description") ?? "").trim();
  const priceRub = Number(formData.get("priceRub"));
  const stock = Number(formData.get("stock"));
  const categoryId = String(formData.get("categoryId") ?? "");
  const materials = String(formData.get("materials") ?? "").trim() || null;
  const dimensions = String(formData.get("dimensions") ?? "").trim() || null;
  const resolvedImage = await resolveProductImage(formData, existing.imageUrl);

  if (!title || !slug || !description || !categoryId) {
    return { error: "Заполните обязательные поля" };
  }
  if (resolvedImage.error || !resolvedImage.imageUrl) return { error: resolvedImage.error };
  if (!Number.isFinite(priceRub) || priceRub < 1) return { error: "Цена некорректна" };
  if (!Number.isFinite(stock) || stock < 0) return { error: "Остаток некорректен" };

  const slugTaken = await prisma.product.findFirst({
    where: { slug, NOT: { id: productId } },
  });
  if (slugTaken) return { error: "Такой slug уже занят — укажите другой" };

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        title,
        slug,
        description,
        priceRub: Math.round(priceRub),
        stock: Math.round(stock),
        categoryId,
        imageUrl: resolvedImage.imageUrl,
        materials,
        dimensions,
        status: ProductStatus.PENDING,
      },
    });
  } catch {
    return { error: "Не удалось сохранить товар" };
  }

  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/seller/dashboard");
  revalidatePath("/admin/moderation");
  revalidatePath("/admin/dashboard");
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
