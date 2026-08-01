// Shapes returned by the mosaic-generator's `/process` response, reused
// wherever a generated mosaic is rendered (create flow, cart).
export interface Placement {
  part_id: string;
  part_name: string;
  color_id: number;
  row: number;
  col: number;
  brick_width: number;
  brick_height: number;
}

export interface Part {
  part_id: string;
  part_name: string;
  color_id: number;
  color_name: string;
  rgb: [number, number, number];
  quantity: number;
}
