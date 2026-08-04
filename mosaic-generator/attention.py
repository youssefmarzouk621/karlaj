"""Where in the picture does detail actually matter?

The tiler has a fixed budget of 1x1 plates (the cap on the 1x1 part). Spent
well, that budget buys crisp eyes, a clean jawline, readable lettering. Spent
badly it buys nothing: measured on the sample images, **73-77% of 1x1 bricks
were landing in the background**, where a 2x4 plate would have looked identical.

This module produces a per-stud priority map so the tiler can spend the budget
where it shows:

    2 = silhouette   the salient subject
    1 = text         detected lettering
    0 = background   everything else, free to merge into big plates

Silhouette outranks text, per product decision: when there isn't budget for
both, the subject is what makes a mosaic recognisable from across the room.

Everything here is classic OpenCV — no model files, no extra dependencies. The
cost is precision on stylised type; see `detect_text` for what that means.
"""

from __future__ import annotations

import cv2
import numpy as np

# Priority levels, highest wins where regions overlap.
BACKGROUND = 0
TEXT = 1
SILHOUETTE = 2

# Detection runs at these working resolutions, not the source resolution: they
# are enough to find regions, and keep a 17MP phone photo from costing seconds.
# GrabCut is superlinear and only needs to place a boundary, so it gets the
# smaller frame; text needs enough pixels for characters to survive as
# components, so it gets the larger one.
#
# 256 rather than 320 for the silhouette: GrabCut dominates this module's
# runtime, and dropping to 256 cut it by a third while moving every quality
# metric on the sample set by less than 0.005. The extra resolution was pure
# cost.
SILHOUETTE_WORK = 256
TEXT_WORK = 480


def _work_image(bgr: np.ndarray, size: int) -> np.ndarray:
    scale = size / max(bgr.shape[:2])
    if scale >= 1.0:
        return bgr
    return cv2.resize(bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)


def spectral_saliency(gray: np.ndarray) -> np.ndarray:
    """Spectral-residual saliency (Hou & Zhang 2007), float 0..1.

    Chosen over cv2.saliency because that lives in opencv-contrib, which we
    don't depend on. It's crude, but as a *prior* for GrabCut it only has to be
    roughly right about where the subject is.
    """
    small = cv2.resize(gray, (64, 64)).astype(np.float32)
    spectrum = np.fft.fft2(small)
    log_amplitude = np.log(np.abs(spectrum) + 1e-8)
    phase = np.angle(spectrum)
    residual = log_amplitude - cv2.blur(log_amplitude, (3, 3))
    saliency = np.abs(np.fft.ifft2(np.exp(residual + 1j * phase))) ** 2
    saliency = cv2.GaussianBlur(saliency, (9, 9), 2.5)
    saliency = cv2.resize(saliency, (gray.shape[1], gray.shape[0]))
    return cv2.normalize(saliency, None, 0.0, 1.0, cv2.NORM_MINMAX)


def detect_silhouette(bgr: np.ndarray) -> np.ndarray:
    """Binary foreground mask (uint8 0/1) at the input's resolution.

    Saliency gives a prior; GrabCut turns it into a mask with edges that follow
    the subject instead of a blurry blob. Falls back to the thresholded
    saliency if GrabCut fails to find anything (it can, on flat images).
    """
    work = _work_image(bgr, SILHOUETTE_WORK)
    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    saliency = spectral_saliency(gray)

    # Seed GrabCut: confident foreground where saliency is high, confident
    # background at the frame edge, "probably" everywhere between.
    seed = np.full(work.shape[:2], cv2.GC_PR_BGD, dtype=np.uint8)
    seed[saliency > saliency.mean() + 0.5 * saliency.std()] = cv2.GC_PR_FGD
    seed[saliency > saliency.mean() + 1.5 * saliency.std()] = cv2.GC_FGD
    border = max(2, int(0.02 * max(work.shape[:2])))
    seed[:border, :] = cv2.GC_BGD
    seed[-border:, :] = cv2.GC_BGD
    seed[:, :border] = cv2.GC_BGD
    seed[:, -border:] = cv2.GC_BGD

    mask = None
    if (seed == cv2.GC_FGD).any():
        try:
            bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
            cv2.grabCut(work, seed, None, bgd, fgd, 2, cv2.GC_INIT_WITH_MASK)
            mask = np.where((seed == cv2.GC_FGD) | (seed == cv2.GC_PR_FGD), 1, 0).astype(np.uint8)
        except cv2.error:
            mask = None

    # A mask covering almost everything (or almost nothing) tells us nothing
    # about where to spend the budget — fall back to the saliency threshold.
    if mask is None or not (0.02 < mask.mean() < 0.85):
        mask = (saliency > saliency.mean() + saliency.std()).astype(np.uint8)

    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    return cv2.resize(mask, (bgr.shape[1], bgr.shape[0]), interpolation=cv2.INTER_NEAREST)


def _stroke_stats(region_mask: np.ndarray, box_min_side: int) -> tuple[float, float]:
    """(variation, thickness) of a component's strokes, via distance transform.

    - variation = std/mean. A letter stroke has near-constant thickness, so
      this is low; organic shapes vary a lot.
    - thickness = mean distance-to-edge relative to the box's short side. This
      is the discriminator that matters most in practice: a letter is a thin
      ribbon (thickness well under 0.2), while a face, a hand or a flower is a
      *filled* blob whose interior is far from any edge. Without it, MSER
      happily reports the two faces in a wedding photo as a line of text,
      because they are similarly sized and share a baseline.
    """
    dist = cv2.distanceTransform(region_mask, cv2.DIST_L2, 3)
    values = dist[region_mask > 0]
    if values.size == 0 or values.mean() < 1e-6 or box_min_side <= 0:
        return 1e9, 1e9
    return float(values.std() / values.mean()), float(values.mean() / box_min_side)


def _mser_boxes(gray: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Character-shaped MSER components, as (x, y, w, h) boxes.

    Run on the image and its inverse so both dark-on-light and light-on-dark
    lettering is found — the white "ISSA" over pink is the second kind.
    """
    h, w = gray.shape
    boxes: list[tuple[int, int, int, int]] = []
    mser = cv2.MSER_create(delta=5, min_area=int(2e-5 * h * w) + 10,
                           max_area=int(0.05 * h * w))

    for image in (gray, 255 - gray):
        regions, _ = mser.detectRegions(image)
        for region in regions:
            x, y, bw, bh = cv2.boundingRect(region.reshape(-1, 1, 2))
            # Cheap geometric rejects first — the distance transform below is
            # the expensive part and most candidates never need to reach it.
            if bw == 0 or bh == 0 or bh < 0.02 * h or bh > 0.30 * h:
                continue
            aspect = bw / bh
            fill = len(region) / float(bw * bh)
            if not (0.08 < aspect < 4.0 and 0.15 < fill < 0.90):
                continue
            local = np.zeros((bh + 2, bw + 2), np.uint8)
            local[region[:, 1] - y + 1, region[:, 0] - x + 1] = 255
            variation, thickness = _stroke_stats(local, min(bw, bh))
            if variation > 0.62 or thickness > 0.20:
                continue
            boxes.append((x, y, bw, bh))
    return boxes


Box = tuple[int, int, int, int]

# A detection sweeping more of the frame than this is not lettering, it is the
# detector latching onto texture. Groups are accepted strongest-first until the
# budget runs out, so a real headline survives and a field of palm fronds
# doesn't.
TEXT_AREA_BUDGET = 0.12


def _same_line(a: Box, b: Box) -> bool:
    """Do two character boxes plausibly belong to the same word/line?"""
    (x1, y1, w1, h1), (x2, y2, w2, h2) = a, b
    if abs((y2 + h2 / 2) - (y1 + h1 / 2)) > 0.6 * max(h1, h2):
        return False                                  # different baseline
    if not (0.5 < h2 / max(1, h1) < 2.0):
        return False                                  # very different size
    gap = x2 - (x1 + w1) if x2 > x1 else x1 - (x2 + w2)
    return gap <= 2.0 * max(h1, h2)                   # close enough to be one line


def _group_into_lines(boxes: list[Box], min_run: int = 4) -> list[Box]:
    """Keep boxes that form a strong horizontal run of similar-sized peers.

    This is the precision fix. Raw MSER flags ~50% of a busy album cover as
    "character-like"; what actually distinguishes text is *repetition along a
    baseline*, so boxes are linked into line groups and only whole groups are
    accepted.

    Groups are then ranked by `count x mean height` — a headline of four big
    letters beats a scattering of small look-alike shapes — and taken until the
    area budget is spent. Without that ranking, foliage and flame motifs (which
    really are thin, uniform strokes, and so pass every per-character test)
    would claim as much of the 1x1 budget as the title does.
    """
    if len(boxes) < min_run:
        return []

    # De-duplicate near-identical boxes (the two MSER passes overlap heavily).
    unique: list[Box] = []
    for box in sorted(boxes, key=lambda b: (b[1], b[0])):
        if not any(abs(box[0] - u[0]) < 3 and abs(box[1] - u[1]) < 3
                   and abs(box[2] - u[2]) < 3 and abs(box[3] - u[3]) < 3 for u in unique):
            unique.append(box)

    # Union-find over the "same line" relation -> line groups.
    parent = list(range(len(unique)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(unique)):
        for j in range(i + 1, len(unique)):
            if _same_line(unique[i], unique[j]):
                parent[find(i)] = find(j)

    groups: dict[int, list[Box]] = {}
    for i, box in enumerate(unique):
        groups.setdefault(find(i), []).append(box)

    scored = [
        (len(g) * (sum(b[3] for b in g) / len(g)), g)
        for g in groups.values()
        if len(g) >= min_run
    ]
    scored.sort(key=lambda t: -t[0])
    return [box for _, group in scored for box in group]


def _apply_area_budget(mask: np.ndarray, boxes: list[Box]) -> np.ndarray:
    """Paint boxes into `mask` strongest-first, stopping at the area budget."""
    budget = TEXT_AREA_BUDGET * mask.size
    used = 0.0
    for x, y, w, h in boxes:
        if used + w * h > budget:
            break
        cv2.rectangle(mask, (x, y), (x + w, y + h), 1, -1)
        used += w * h
    return mask


def detect_text(bgr: np.ndarray) -> np.ndarray:
    """Binary text mask (uint8 0/1) at the input's resolution.

    Classic CV, so expect misses rather than false alarms: clean poster
    lettering (large, high-contrast, aligned) is found reliably; small,
    stylised, or heavily-occluded type often isn't. That trade is deliberate —
    a false positive spends the 1x1 budget on nothing, which is the failure
    mode we are trying to fix in the first place.
    """
    work = _work_image(bgr, TEXT_WORK)
    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)

    boxes = _group_into_lines(_mser_boxes(gray))
    mask = _apply_area_budget(np.zeros(work.shape[:2], np.uint8), boxes)

    if mask.any():
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    return cv2.resize(mask, (bgr.shape[1], bgr.shape[0]), interpolation=cv2.INTER_NEAREST)


def priority_map(bgr: np.ndarray, width: int, height: int,
                 want_text: bool = True) -> np.ndarray:
    """Per-stud priority grid, shape (height, width), values BACKGROUND/TEXT/SILHOUETTE.

    `bgr` is the center-cropped source image, at whatever resolution — detection
    is done there (where strokes and edges still exist) and only the resulting
    masks are downsampled to the stud grid. Detecting on the already-pixelated
    grid would be far too coarse to find anything.
    """
    silhouette = detect_silhouette(bgr)
    text = detect_text(bgr) if want_text else np.zeros_like(silhouette)

    def to_studs(mask: np.ndarray) -> np.ndarray:
        # Area-average then threshold: a stud counts as inside the region when
        # a meaningful share of its source pixels are.
        small = cv2.resize(mask.astype(np.float32), (width, height),
                           interpolation=cv2.INTER_AREA)
        return small > 0.35

    grid = np.full((height, width), BACKGROUND, dtype=np.uint8)
    grid[to_studs(text)] = TEXT
    grid[to_studs(silhouette)] = SILHOUETTE  # silhouette wins overlaps
    return grid
