import {
  PrismaPg,
} from "@prisma/adapter-pg";

import {
  PrismaClient,
} from "../generated/prisma/client.js";

export function createPrismaClient(
  databaseUrl: string,
): PrismaClient {
  const adapter =
    new PrismaPg({
      connectionString:
        databaseUrl,
    });

  return new PrismaClient({
    adapter,
  });
}

export async function isDatabaseReady(
  prisma: PrismaClient,
): Promise<boolean> {
  try {
    await prisma.$queryRaw`
      SELECT 1
    `;

    return true;
  } catch {
    return false;
  }
}
