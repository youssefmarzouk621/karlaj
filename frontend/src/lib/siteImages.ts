import { prisma, SITE_IMAGE_SLOTS } from "@/lib/db";

export interface HomeImage {
  src: string;
  alt: string;
  title: string;
  meta: string;
}

/**
 * Every homepage image slot resolved to a URL: the admin's upload if there is
 * one, else the bundled default. Never throws — if the database is down the
 * page still renders with the defaults.
 */
export async function getHomeImages(): Promise<Record<string, HomeImage>> {
  const rows = await prisma.siteImage
    .findMany({ select: { slot: true, alt: true, title: true, meta: true, updatedAt: true } })
    .catch(() => []);
  const uploaded = new Map(rows.map((r) => [r.slot, r]));

  return Object.fromEntries(
    SITE_IMAGE_SLOTS.map(({ slot, defaultSrc, defaultAlt, defaultTitle, defaultMeta, captioned }) => {
      const d = { alt: defaultAlt, title: defaultTitle, meta: defaultMeta };
      const row = uploaded.get(slot);
      if (!row) return [slot, { src: defaultSrc, ...d }];
      return [
        slot,
        {
          src: `/api/site-image/${slot}?v=${row.updatedAt.getTime()}`,
          alt: row.alt || d.alt,
          title: captioned ? row.title || d.title : "",
          meta: captioned ? row.meta || d.meta : "",
        },
      ];
    })
  );
}
