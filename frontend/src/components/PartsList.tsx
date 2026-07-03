"use client";

interface Part {
  part_id: string;
  part_name: string;
  color_id: number;
  color_name: string;
  rgb: [number, number, number];
  quantity: number;
}

interface Bag {
  bag_number: number;
  parts: Part[];
  total_parts: number;
  section: {
    row_start: number;
    row_end: number;
    col_start: number;
    col_end: number;
  };
}

interface Props {
  partsList: Part[];
  bags: Bag[];
  totalParts: number;
}

function ColorSwatch({ rgb }: { rgb: [number, number, number] }) {
  return (
    <span
      className="inline-block w-4 h-4 rounded-sm border border-border-custom mr-2 align-middle shrink-0"
      style={{ backgroundColor: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }}
    />
  );
}

export default function PartsList({ partsList, bags, totalParts }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg mb-2">
          Total Parts: {totalParts.toLocaleString()}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
          {partsList.map((p) => (
            <div
              key={`${p.part_id}-${p.color_id}`}
              className="flex items-center py-0.5"
            >
              <ColorSwatch rgb={p.rgb} />
              <span className="text-muted mr-1">{p.part_name}</span>
              <span className="text-text truncate">{p.color_name}</span>
              <span className="ml-auto font-medium tabular-nums pl-2 text-text">
                x{p.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-lg mb-3">Bag Breakdown</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {bags.map((bag) => (
            <div
              key={bag.bag_number}
              className="border border-border-custom bg-surface rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-accent">
                  Bag {bag.bag_number}
                </span>
                <span className="text-sm text-muted">
                  {bag.total_parts} pcs
                </span>
              </div>
              <p className="text-xs text-muted mb-2">
                Rows {bag.section.row_start + 1}–{bag.section.row_end}, Cols{" "}
                {bag.section.col_start + 1}–{bag.section.col_end}
              </p>
              <div className="space-y-0.5 text-sm">
                {bag.parts.map((p) => (
                  <div
                    key={`${p.part_id}-${p.color_id}`}
                    className="flex items-center"
                  >
                    <ColorSwatch rgb={p.rgb} />
                    <span className="text-muted mr-1 text-xs">
                      {p.part_name}
                    </span>
                    <span className="text-text truncate">
                      {p.color_name}
                    </span>
                    <span className="ml-auto font-medium tabular-nums pl-2 text-text">
                      x{p.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
