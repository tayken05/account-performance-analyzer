import { getSql } from "@/lib/db";

export async function GET() {
  try {
    const sql = getSql();
    await sql`SELECT 1 AS ok`;

    return Response.json({
      ok: true,
      database: "connected",
    });
  } catch {
    return Response.json(
      { ok: false, error: "Database is unavailable" },
      { status: 500 },
    );
  }
}
