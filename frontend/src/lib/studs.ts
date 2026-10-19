// A LEGO stud pitch is 8 mm, so a mosaic's real-world size is studs × 0.8 cm.
export const STUD_CM = 0.8;
export const MIN_STUDS = 16;
export const MAX_STUDS = 128;

export const clampStuds = (n: number, min = MIN_STUDS, max = MAX_STUDS) =>
  Math.max(min, Math.min(max, Math.round(n) || min));

const cm = (studs: number) => {
  const v = studs * STUD_CM;
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
};

export const sizeCm = (w: number, h: number) =>
  w === h ? `${cm(w)} cm` : `${cm(w)}×${cm(h)} cm`;
