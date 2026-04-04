import { getAuthUserFromCookie, unauthorizedResponse } from "@/lib/auth";
import {
  listActiveDispatches,
  listActiveOperators,
  listActiveStatusLogMissions,
  serializeDispatchRow,
  serializeStatusLogMission,
} from "@/lib/dispatch";

export async function GET() {
  const user = await getAuthUserFromCookie();
  if (!user) return unauthorizedResponse();

  try {
    const [dispatchRows, statusLogRows, operators] = await Promise.all([
      listActiveDispatches(),
      listActiveStatusLogMissions(),
      listActiveOperators(),
    ]);

    const fromDispatches = dispatchRows.map(serializeDispatchRow);
    const fromStatusLogs = statusLogRows.map(serializeStatusLogMission);
    const all = [...fromDispatches, ...fromStatusLogs];

    return Response.json({
      ok: true,
      dispatches: all.map((s) => s.dispatchItem),
      bookings: all.map((s) => s.booking),
      operators,
    });
  } catch (error) {
    console.error("GET /api/dispatch/items failed", error);
    return Response.json(
      { ok: false, error: "Base de données inaccessible." },
      { status: 503 },
    );
  }
}
