import { prisma } from "@/lib/prisma";

const LOCAL_USER_ID = "local-user";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as { name?: string; isArchived?: boolean };
  const data: { name?: string; isArchived?: boolean } = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return Response.json({ error: "name cannot be empty." }, { status: 400 });
    data.name = body.name.trim();
  }
  if (body.isArchived !== undefined) data.isArchived = body.isArchived;
  try {
    const category = await prisma.category.update({ where: { id, localUserId: LOCAL_USER_ID }, data });
    return Response.json({ category: { id: category.id, groupId: category.groupId, name: category.name, source: category.source, isArchived: category.isArchived } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to update category." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  // System/default categories can't be hard-deleted (referenced by transactions/recurring/etc.).
  // Try delete; on FK violation, archive instead.
  try {
    const category = await prisma.category.findUnique({ where: { id, localUserId: LOCAL_USER_ID } });
    if (!category) return Response.json({ error: "Category not found." }, { status: 404 });
    if (category.source === "custom") {
      // Detach children to avoid cascading surprises.
      await prisma.transaction.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
      await prisma.recurringExpense.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
      await prisma.budget.deleteMany({ where: { categoryId: id } });
      await prisma.merchantRule.deleteMany({ where: { categoryId: id } });
      await prisma.category.delete({ where: { id } });
      return Response.json({ deleted: true });
    }
    await prisma.category.update({ where: { id }, data: { isArchived: true } });
    return Response.json({ archived: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to delete category." }, { status: 500 });
  }
}
