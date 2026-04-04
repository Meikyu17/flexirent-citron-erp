import { getAuthUserFromCookie, hashPassword, loginWithCredentials, unauthorizedResponse } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  } catch {
    return Response.json({ ok: false, error: "Corps de requête invalide." }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return Response.json({ ok: false, error: "Tous les champs sont requis." }, { status: 400 });
  }

  if (newPassword.length < 8) {
    return Response.json({ ok: false, error: "Le nouveau mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
  }

  const valid = await loginWithCredentials(user.email, currentPassword);
  if (!valid) {
    return Response.json({ ok: false, error: "Mot de passe actuel incorrect." }, { status: 401 });
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.userPasswordOverride.upsert({
    where: { email: user.email },
    update: { passwordHash, updatedAt: new Date() },
    create: { email: user.email, passwordHash },
  });

  return Response.json({ ok: true });
}
