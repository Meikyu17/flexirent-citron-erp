import { createAccessToken, loginWithCredentials, setAuthCookie } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    const user = await loginWithCredentials(data.email, data.password);
    if (!user) {
      return Response.json(
        { ok: false, error: "Identifiants invalides" },
        { status: 401 },
      );
    }

    const token = await createAccessToken(user);
    await setAuthCookie(token);

    return Response.json({
      ok: true,
      user,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: "Requete de connexion invalide",
        details: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 400 },
    );
  }
}
