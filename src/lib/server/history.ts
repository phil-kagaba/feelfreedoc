import "server-only";
import { q } from "./db";

/** Stores only metadata about a job (tool, file names, sizes) — never document content. */
export async function recordHistory(userId: string, tool: string, files: { name: string; size: number }[], outputBytes: number) {
  try {
    const names = files.map((f) => String(f.name).slice(0, 200)).join(", ").slice(0, 1000);
    const input = files.reduce((n, f) => n + (Number(f.size) || 0), 0);
    await q(
      "INSERT INTO history (user_id, tool, file_names, file_count, input_bytes, output_bytes) VALUES ($1, $2, $3, $4, $5, $6)",
      [userId, tool, names, files.length, input, Math.max(0, Math.round(outputBytes) || 0)],
    );
    // Keep history bounded per user.
    await q(
      `DELETE FROM history WHERE user_id = $1 AND id NOT IN
         (SELECT id FROM history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500)`,
      [userId],
    );
  } catch (e) {
    console.error("[history]", e);
  }
}
