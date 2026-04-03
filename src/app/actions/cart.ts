"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateCartId } from "@/lib/cart-queries";
import { auth } from "@/auth";

export async function addToCart(productId: string, quantity = 1) {
  const { cartId } = await getOrCreateCartId();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.status !== "PUBLISHED" || product.stock < quantity) {
    return { error: "Товар недоступен" };
  }

  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId, productId } },
  });
  if (existing) {
    const nextQty = existing.quantity + quantity;
    if (nextQty > product.stock) {
      return { error: "Недостаточно на складе" };
    }
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: nextQty },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId, productId, quantity },
    });
  }
  revalidatePath("/");
  revalidatePath("/catalog");
  revalidatePath("/cart");
  return { ok: true };
}

export async function updateCartItem(itemId: string, quantity: number): Promise<void> {
  const { cartId } = await getOrCreateCartId();
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId },
    include: { product: true },
  });
  if (!item) return;
  if (quantity < 1) {
    await prisma.cartItem.delete({ where: { id: itemId } });
  } else {
    if (quantity > item.product.stock) return;
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  }
  revalidatePath("/cart");
}

export async function removeCartItem(itemId: string): Promise<void> {
  const { cartId } = await getOrCreateCartId();
  await prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
  revalidatePath("/cart");
}

export async function checkoutAction() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/cart");
  }

  const { cartId } = await getOrCreateCartId();
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    include: { product: true },
  });
  if (items.length === 0) {
    redirect("/cart?error=empty");
  }

  let subtotal = 0;
  for (const it of items) {
    if (it.product.status !== "PUBLISHED" || it.quantity > it.product.stock) {
      redirect(`/cart?error=${encodeURIComponent(`Проверьте позицию: ${it.product.title}`)}`);
    }
    subtotal += it.product.priceRub * it.quantity;
  }

  const deliveryRub = subtotal >= 15000 ? 0 : 750;
  const total = subtotal + deliveryRub;

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId: session.user!.id,
        totalRub: total,
        status: "PENDING",
      },
    });
    for (const it of items) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: it.productId,
          quantity: it.quantity,
          priceRub: it.product.priceRub,
          productTitle: it.product.title,
        },
      });
      await tx.product.update({
        where: { id: it.productId },
        data: { stock: { decrement: it.quantity } },
      });
    }
    await tx.cartItem.deleteMany({ where: { cartId } });
  });

  revalidatePath("/cart");
  redirect("/cart?success=1");
}
