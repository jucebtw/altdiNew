import { PrismaClient, UserRole, ProductStatus, DesignerStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Demo123!", 10);

  await prisma.message.deleteMany();
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.designerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  const categories = await Promise.all([
    prisma.category.create({
      data: { slug: "ceramics", name: "Керамика" },
    }),
    prisma.category.create({
      data: { slug: "lighting", name: "Освещение" },
    }),
    prisma.category.create({
      data: { slug: "textiles", name: "Текстиль" },
    }),
    prisma.category.create({
      data: { slug: "wall-decor", name: "Настенный декор" },
    }),
  ]);

  const cat = (slug: string) => categories.find((c) => c.slug === slug)!;

  const admin = await prisma.user.create({
    data: {
      email: "admin@atelier.local",
      name: "Администратор",
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const sellerUser = await prisma.user.create({
    data: {
      email: "maria@atelier.local",
      name: "Мария Светлова",
      passwordHash,
      role: UserRole.SELLER,
    },
  });

  const buyer = await prisma.user.create({
    data: {
      email: "buyer@atelier.local",
      name: "Екатерина Покупатель",
      passwordHash,
      role: UserRole.BUYER,
    },
  });

  const designer = await prisma.designerProfile.create({
    data: {
      userId: sellerUser.id,
      slug: "maria-svetlova",
      studioName: "Студия керамики «Светлана»",
      city: "Санкт-Петербург",
      specialty: "Керамика и скульптура",
      bio: "Создаю предметы из керамики вручную: вазы, чаши и декор с матовой глазурью и текстурой, вдохновлённой природой Севера.",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
      status: DesignerStatus.APPROVED,
      ratingAvg: 4.9,
      reviewCount: 128,
      followerCount: 512,
    },
  });

  const ogonUser = await prisma.user.create({
    data: {
      email: "ogon@atelier.local",
      name: "Мастерская «Огонь»",
      passwordHash,
      role: UserRole.SELLER,
    },
  });

  const workshop = await prisma.designerProfile.create({
    data: {
      userId: ogonUser.id,
      slug: "masterskaya-ogon",
      studioName: "Мастерская «Огонь»",
      city: "Москва",
      specialty: "Светильники и металл",
      bio: "Авторские светильники и декор из металла и стекла для тёплого света в интерьере.",
      status: DesignerStatus.APPROVED,
      ratingAvg: 4.8,
      reviewCount: 64,
      followerCount: 210,
    },
  });

  const productsData = [
    {
      designerId: designer.id,
      categoryId: cat("ceramics").id,
      title: 'Ваза «Светлана»',
      slug: "vaza-svetlana",
      description:
        "Ручная керамика с матовой глазурью. Идеально для сухоцветов и как самостоятельный акцент.",
      priceRub: 5800,
      stock: 12,
      materials: "Керамика, глазурь",
      dimensions: "Высота 25 см, диаметр 15 см",
      imageUrl:
        "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&h=800&fit=crop",
      status: ProductStatus.PUBLISHED,
    },
    {
      designerId: designer.id,
      categoryId: cat("ceramics").id,
      title: 'Чаша «Земля»',
      slug: "chasha-zemlya",
      description: "Глубокая чаша для сервировки, тёплые землистые тона.",
      priceRub: 4200,
      stock: 8,
      materials: "Керамика",
      dimensions: "Диаметр 22 см",
      imageUrl:
        "https://images.unsplash.com/photo-1610701596007-1150874949bb?w=800&h=800&fit=crop",
      status: ProductStatus.PUBLISHED,
    },
    {
      designerId: workshop.id,
      categoryId: cat("lighting").id,
      title: 'Лампа настольная «Вега»',
      slug: "lampa-vega",
      description: "Мягкий рассеянный свет, латунь и матовое стекло.",
      priceRub: 6800,
      stock: 5,
      materials: "Латунь, стекло",
      dimensions: "Высота 42 см",
      imageUrl:
        "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&h=800&fit=crop",
      status: ProductStatus.PUBLISHED,
    },
    {
      designerId: designer.id,
      categoryId: cat("textiles").id,
      title: "Наволочка льняная",
      slug: "navolochka-ln",
      description: "Плотный лён, натуральный цвет.",
      priceRub: 2900,
      stock: 20,
      materials: "100% лён",
      dimensions: "50×70 см",
      imageUrl:
        "https://images.unsplash.com/photo-1584100936595-c65d5c6c0c4c?w=800&h=800&fit=crop",
      status: ProductStatus.PUBLISHED,
    },
    {
      designerId: workshop.id,
      categoryId: cat("wall-decor").id,
      title: "Панно на стену",
      slug: "panno-stena",
      description: "Текстильное панно ручной работы.",
      priceRub: 4500,
      stock: 7,
      materials: "Хлопок, дерево",
      dimensions: "60×40 см",
      imageUrl:
        "https://images.unsplash.com/photo-1513519245088-0e12902e5a01?w=800&h=800&fit=crop",
      status: ProductStatus.PUBLISHED,
    },
    {
      designerId: designer.id,
      categoryId: cat("ceramics").id,
      title: 'Ваза «На модерации»',
      slug: "vaza-moderation",
      description: "Тестовый товар на проверке.",
      priceRub: 3200,
      stock: 3,
      materials: "Керамика",
      dimensions: "Высота 18 см",
      status: ProductStatus.PENDING,
      imageUrl:
        "https://images.unsplash.com/photo-1612196808210-71d7d82b1b1b?w=800&h=800&fit=crop",
    },
  ];

  for (const p of productsData) {
    await prisma.product.create({ data: p });
  }

  await prisma.review.create({
    data: {
      userId: buyer.id,
      productId: (await prisma.product.findFirst({ where: { slug: "vaza-svetlana" } }))!.id,
      rating: 5,
      comment: "Очень красивая ваза, упаковка аккуратная.",
      approved: true,
    },
  });

  console.log("Seed OK. Demo passwords for all users: Demo123!");
  console.log("Admin:", admin.email);
  console.log("Seller:", sellerUser.email);
  console.log("Buyer:", buyer.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
