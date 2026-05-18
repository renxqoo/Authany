import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenantId = requiredEnv("TENANT_ID");
  const now = Date.now();

  const duplicateAudiences = await prisma.targetResourceRegistration.groupBy({
    by: ["audience"],
    where: { tenantId, status: "active" },
    _count: { _all: true },
    having: {
      audience: {
        _count: {
          gt: 1
        }
      }
    }
  });

  for (const item of duplicateAudiences) {
    const duplicates = await prisma.targetResourceRegistration.findMany({
      where: {
        tenantId,
        status: "active",
        audience: item.audience
      },
      orderBy: { createdAt: "asc" }
    });
    for (const target of duplicates.slice(1)) {
      await prisma.targetResourceRegistration.update({
        where: { id: target.id },
        data: { status: "inactive" }
      });
    }
  }

  const indefiniteGrants = await prisma.accessGrant.findMany({
    where: {
      tenantId,
      status: "active",
      expiresAt: null
    }
  });
  for (const grant of indefiniteGrants) {
    await prisma.accessGrant.update({
      where: { id: grant.id },
      data: {
        expiresAt: new Date(now + 24 * 60 * 60 * 1000)
      }
    });
  }

  const weakConnections = await prisma.targetConnection.findMany({
    where: {
      tenantId,
      status: "active",
      OR: [
        { externalContextMode: "optional", allowedContextProvidersJson: { equals: [] } },
        { externalContextMode: "required", allowedContextProvidersJson: { equals: [] } }
      ]
    }
  });
  for (const connection of weakConnections) {
    await prisma.targetConnection.update({
      where: { id: connection.id },
      data: {
        externalContextMode: "forbidden",
        allowedContextProvidersJson: []
      }
    });
  }

  console.log(JSON.stringify({
    tenantId,
    duplicateAudiencesDisabled: duplicateAudiences.length,
    indefiniteGrantsUpdated: indefiniteGrants.length,
    weakConnectionsTightened: weakConnections.length
  }, null, 2));
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
