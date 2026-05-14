import { prisma } from "../lib/importHelpers";

async function main() {
  const all = await prisma.category.findMany({ where: { localUserId: "local-user", groupId: "grp-goals" } });
  console.log(`== ALL grp-goals categories (${all.length}) ==`);
  all.forEach((c) => console.log(`  ${c.id}\t${c.name}\tarchived=${c.isArchived}`));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
