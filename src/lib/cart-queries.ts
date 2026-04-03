import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const CART_COOKIE = "atelier_cart_session";

/**
 * Только чтение: безопасно для Server Components (шапка, страница корзины).
 * Не создаёт корзину и не меняет cookies.
 */
export async function getCartIdForRead(): Promise<string | null> {
  const session = await auth();
  const cookieStore = await cookies();

  if (session?.user?.id) {
    const cart = await prisma.cart.findUnique({ where: { userId: session.user.id } });
    return cart?.id ?? null;
  }

  const sessionId = cookieStore.get(CART_COOKIE)?.value;
  if (!sessionId) return null;

  const cart = await prisma.cart.findUnique({ where: { sessionId } });
  return cart?.id ?? null;
}

export async function getCartItemCount(): Promise<number> {
  const cartId = await getCartIdForRead();
  if (!cartId) return 0;
  const agg = await prisma.cartItem.aggregate({
    where: { cartId },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

/**
 * Только из Server Actions (`"use server"`): может вызывать cookies().set / delete.
 * Не вызывайте из RSC — иначе ошибка Next.js про модификацию cookies.
 */
export async function getOrCreateCartId(): Promise<{ cartId: string; sessionId?: string }> {
  const session = await auth();
  const cookieStore = await cookies();

  if (session?.user?.id) {
    let cart = await prisma.cart.findUnique({ where: { userId: session.user.id } });
    if (cart) {
      cookieStore.delete(CART_COOKIE);
      return { cartId: cart.id };
    }

    const guestSession = cookieStore.get(CART_COOKIE)?.value;
    cart = await prisma.$transaction(async (tx) => {
      const newCart = await tx.cart.create({
        data: { userId: session.user.id },
      });
      if (guestSession) {
        const guest = await tx.cart.findUnique({
          where: { sessionId: guestSession },
          include: { items: true },
        });
        if (guest && guest.id !== newCart.id) {
          for (const item of guest.items) {
            const existing = await tx.cartItem.findUnique({
              where: {
                cartId_productId: { cartId: newCart.id, productId: item.productId },
              },
            });
            if (existing) {
              await tx.cartItem.update({
                where: { id: existing.id },
                data: { quantity: existing.quantity + item.quantity },
              });
            } else {
              await tx.cartItem.create({
                data: {
                  cartId: newCart.id,
                  productId: item.productId,
                  quantity: item.quantity,
                },
              });
            }
          }
          await tx.cart.delete({ where: { id: guest.id } });
        }
      }
      return newCart;
    });
    cookieStore.delete(CART_COOKIE);
    return { cartId: cart.id };
  }

  let sessionId = cookieStore.get(CART_COOKIE)?.value;
  if (!sessionId) {
    sessionId = randomUUID();
    cookieStore.set(CART_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
  }

  let cart = await prisma.cart.findUnique({ where: { sessionId } });
  if (!cart) {
    cart = await prisma.cart.create({ data: { sessionId } });
  }

  return { cartId: cart.id, sessionId };
}
