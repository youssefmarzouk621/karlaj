import type { PrismaClient } from "@prisma/client";

/**
 * App-wide settings live in the `settings` key/value table (see `Setting` in the
 * schema). Helpers here centralize the keys + defaults so the dashboard (writes)
 * and the frontend (reads server-side) never drift.
 */

export const SETTING_KEYS = {
  /** Gates the frontend's free custom-size inputs + drag-resize. */
  customSizeEnabled: "custom_size_enabled",
} as const;

/** Whether the frontend allows arbitrary custom sizes. Absent ⇒ enabled. */
export async function getCustomSizeEnabled(prisma: PrismaClient): Promise<boolean> {
  const row = await prisma.setting.findUnique({
    where: { key: SETTING_KEYS.customSizeEnabled },
  });
  return row ? row.value === "true" : true;
}
