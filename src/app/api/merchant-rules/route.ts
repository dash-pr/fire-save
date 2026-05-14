import { prisma } from "@/lib/prisma";
import type { MerchantRule } from "@/domain/types";

function serializeRule(rule: { id: string; pattern: string; categoryName: string; categoryId: string; fuzzyMatch: boolean; createdAt: Date }): MerchantRule {
  return {
    id: rule.id,
    pattern: rule.pattern,
    categoryName: rule.categoryName,
    categoryId: rule.categoryId,
    fuzzyMatch: rule.fuzzyMatch,
    createdAt: rule.createdAt.toISOString(),
  };
}

export async function GET() {
  const rules = await prisma.merchantRule.findMany({
    where: { localUserId: "local-user" },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ rules: rules.map(serializeRule) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { pattern?: string; categoryId?: string; fuzzyMatch?: boolean };
  if (!body.pattern?.trim()) return Response.json({ error: "pattern is required." }, { status: 400 });
  if (!body.categoryId) return Response.json({ error: "categoryId is required." }, { status: 400 });

  const category = await prisma.category.findUnique({ where: { id: body.categoryId }, select: { name: true } });
  if (!category) return Response.json({ error: "categoryId was not found." }, { status: 400 });

  const rule = await prisma.merchantRule.create({
    data: {
      pattern: body.pattern.trim(),
      categoryName: category.name,
      categoryId: body.categoryId,
      fuzzyMatch: body.fuzzyMatch ?? true,
    },
  });

  return Response.json({ rule: serializeRule(rule) }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { id?: string; pattern?: string; categoryId?: string; fuzzyMatch?: boolean };
  if (!body.id) return Response.json({ error: "id is required." }, { status: 400 });

  const category = body.categoryId ? await prisma.category.findUnique({ where: { id: body.categoryId }, select: { name: true } }) : null;
  if (body.categoryId && !category) return Response.json({ error: "categoryId was not found." }, { status: 400 });

  const rule = await prisma.merchantRule.update({
    where: { id: body.id },
    data: {
      pattern: body.pattern?.trim(),
      categoryName: category?.name,
      categoryId: body.categoryId,
      fuzzyMatch: body.fuzzyMatch,
    },
  });

  return Response.json({ rule: serializeRule(rule) });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id query parameter is required." }, { status: 400 });

  await prisma.merchantRule.deleteMany({ where: { id, localUserId: "local-user" } });
  return Response.json({ success: true });
}
