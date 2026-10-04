import { prisma, getCustomSizeEnabled } from "@/lib/db";
import CreateFlow from "./CreateFlow";
import type { SizeOption } from "@/components/SizeSelector";

// Always read the latest sizes + flags from the DB (dashboard edits take effect at once).
export const dynamic = "force-dynamic";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ size?: string }>;
}) {
  const [rows, customSizeEnabled] = await Promise.all([
    prisma.mosaicSize.findMany({ orderBy: { sortOrder: "asc" } }),
    getCustomSizeEnabled(prisma),
  ]);
  const sizes: SizeOption[] = rows.map((s) => ({
    width: s.width,
    height: s.height,
    label: s.label,
    enabled: s.enabled,
    displayPrice: s.displayPrice,
  }));

  // `?size=48x48` (the pricing page's "Start with…" links) preselects an enabled size.
  const [w, h] = ((await searchParams).size ?? "").split("x").map(Number);
  const initialSize = sizes.find((s) => s.enabled && s.width === w && s.height === h);

  return (
    <CreateFlow
      sizes={sizes}
      customSizeEnabled={customSizeEnabled}
      initialSize={initialSize ? { width: initialSize.width, height: initialSize.height } : undefined}
    />
  );
}
