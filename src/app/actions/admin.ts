"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DesignerStatus, ProductStatus } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function setDesignerStatus(designerId: string, status: DesignerStatus) {
  await requireAdmin();
  await prisma.designerProfile.update({ where: { id: designerId }, data: { status } });
  revalidatePath("/admin/dashboard");
  revalidatePath("/designers");
  return { ok: true };
}

export async function setProductStatus(productId: string, status: ProductStatus) {
  await requireAdmin();
  await prisma.product.update({ where: { id: productId }, data: { status } });
  revalidatePath("/admin/dashboard");
  revalidatePath("/catalog");
  revalidatePath("/");
  return { ok: true };
}

export async function publishProductForm(formData: FormData) {
  const id = String(formData.get("productId") ?? "");
  if (!id) return;
  await setProductStatus(id, ProductStatus.PUBLISHED);
}

export async function revisionProductForm(formData: FormData) {
  const id = String(formData.get("productId") ?? "");
  if (!id) return;
  await setProductStatus(id, ProductStatus.DRAFT);
}

export async function rejectProductForm(formData: FormData) {
  const id = String(formData.get("productId") ?? "");
  if (!id) return;
  await setProductStatus(id, ProductStatus.REJECTED);
}

export async function approveDesignerForm(formData: FormData) {
  const id = String(formData.get("designerId") ?? "");
  if (!id) return;
  await setDesignerStatus(id, DesignerStatus.APPROVED);
}

export async function rejectDesignerForm(formData: FormData) {
  const id = String(formData.get("designerId") ?? "");
  if (!id) return;
  await setDesignerStatus(id, DesignerStatus.REJECTED);
}
