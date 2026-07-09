import { prisma, getCustomSizeEnabled } from "@/lib/db";
import CreateFlow from "./CreateFlow";
import type { SizeOption } from "@/components/SizeSelector";

// Always read the latest sizes + flags from the DB (dashboard edits take effect at once).
export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const [rows, customSizeEnabled] = await Promise.all([
    prisma.mosaicSize.findMany({ orderBy: { sortOrder: "asc" } }),
    getCustomSizeEnabled(prisma),
  ]);
  const sizes: SizeOption[] = rows.map((s) => ({
    width: s.width,
    height: s.height,
    label: s.label,
    enabled: s.enabled,
  }));

  return <CreateFlow sizes={sizes} customSizeEnabled={customSizeEnabled} />;
}
