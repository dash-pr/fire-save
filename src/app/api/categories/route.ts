import { prisma } from "@/lib/prisma";
import type { Category } from "@/domain/types";

const LOCAL_USER_ID = "local-user";

function serialize(category: {
  id: string;
  groupId: string;
  name: string;
  source: Category["source"];
  isArchived: boolean;
}): Category {
  return {
    id: category.id,
    groupId: category.groupId,
    name: category.name,
    source: category.source,
    isArchived: category.isArchived,
  };
}

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { localUserId: LOCAL_USER_ID },
    orderBy: [{ group: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return Response.json({ categories: categories.map(serialize) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { groupId?: string; name?: string; source?: Category["source"] };
  if (!body.groupId) return Response.json({ error: "groupId is required." }, { status: 400 });
  if (!body.name?.trim()) return Response.json({ error: "name is required." }, { status: 400 });
  try {
    const category = await prisma.category.create({
      data: {
        localUserId: LOCAL_USER_ID,
        groupId: body.groupId,
        name: body.name.trim(),
        source: body.source ?? "custom",
      },
    });
    return Response.json({ category: serialize(category) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to create category." }, { status: 500 });
  }
}
