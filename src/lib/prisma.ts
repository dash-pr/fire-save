import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
	const connectionString = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/fire_save?schema=public";
	return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export function getPrisma() {
	globalForPrisma.prisma ??= createPrismaClient();
	return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
	get(_target, property) {
		const client = getPrisma() as PrismaClient & Record<PropertyKey, unknown>;
		const value = client[property];
		return typeof value === "function" ? value.bind(client) : value;
	},
});

