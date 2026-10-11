/**
 * Local account provisioning. Called by scripts/Provision-User.ps1, which
 * collects the password via a masked prompt into PROVISION_PASSWORD.
 * Never prints the password. Creates users only — never upserts privileges.
 *
 * Usage:
 *   $env:PROVISION_PASSWORD = "<secret>"
 *   npx tsx scripts/provision-user.ts --email a@b.c --role STUDENT [--student-profile-id X | --company-id Y]
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const email = (arg("email") ?? "").trim().toLowerCase();
  const role = (arg("role") ?? "").trim().toUpperCase();
  const studentProfileId = arg("student-profile-id");
  const companyId = arg("company-id");
  const password = process.env.PROVISION_PASSWORD ?? "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    throw new Error("Invalid --email");
  }
  if (!["STUDENT", "RECRUITER", "STAFF", "ADMIN"].includes(role)) {
    throw new Error("Invalid --role (STUDENT | RECRUITER | STAFF | ADMIN)");
  }
  if (password.length < 12 || password.length > 256) {
    throw new Error("Password must be 12–256 characters");
  }
  if (role === "STUDENT" && !studentProfileId) throw new Error("STUDENT requires --student-profile-id");
  if (role === "RECRUITER" && !companyId) throw new Error("RECRUITER requires --company-id");
  if (role !== "STUDENT" && studentProfileId) throw new Error("Only STUDENT takes --student-profile-id");
  if (role !== "RECRUITER" && companyId) throw new Error("Only RECRUITER takes --company-id");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("An account with this email already exists (no privilege changes made)");

  if (studentProfileId) {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: studentProfileId },
      include: { user: { select: { id: true } } },
    });
    if (!profile) throw new Error("Student profile not found");
    if (profile.user) throw new Error("Student profile is already linked to an account");
  }
  if (companyId) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error("Company not found");
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: role as never,
        companyId: companyId ?? undefined,
      },
    });
    if (studentProfileId) {
      await tx.studentProfile.update({
        where: { id: studentProfileId },
        data: { userId: created.id },
      });
    }
    return created;
  });

  // eslint-disable-next-line no-console
  console.log(`Provisioned ${user.role} account ${user.email} (id ${user.id})`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(`Provisioning failed: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
