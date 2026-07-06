"""Guard rails for the adaptive preprocessing pipeline.

Runs with plain `python test_pipeline.py` or under pytest. Uses synthetic images
so it needs no committed binaries; real-photo checks run only if the files in
inputs/ happen to be present.
"""
import os
from io import BytesIO

import numpy as np
from PIL import Image

from image_analysis import analyze_image
from filter_profiles import select_profile, build_recipe


def _studio_image(size=384):
    """Neutral grey wall + a small centered colored blob = studio portrait."""
    arr = np.full((size, size, 3), 180, np.uint8)
    arr[:, :, 2] = 199  # faint bluish-grey, like a real backdrop
    c = size // 2
    arr[c - 40:c + 40, c - 40:c + 40] = [120, 70, 40]  # small subject
    return arr


def _busy_image(size=384):
    """Saturated, high-frequency content everywhere = busy scene."""
    rng = np.random.default_rng(0)
    blocks = rng.integers(0, 255, (size // 8, size // 8, 3), dtype=np.uint8)
    return np.array(Image.fromarray(blocks).resize((size, size), Image.NEAREST))


def _step_names(recipe):
    return [n for n, _ in recipe["steps"]]


def test_studio_routes_to_portrait():
    m = analyze_image(_studio_image())
    assert select_profile(m) == "studio_portrait", m


def test_busy_routes_to_scene():
    m = analyze_image(_busy_image())
    assert select_profile(m) == "busy_scene", m


def test_studio_recipe_unifies_background():
    recipe = build_recipe(analyze_image(_studio_image()))
    assert "unify_background" in _step_names(recipe)


def test_busy_recipe_skips_background_unify():
    recipe = build_recipe(analyze_image(_busy_image()))
    names = _step_names(recipe)
    assert "unify_background" not in names   # backdrop unify is studio-only
    assert "mean_shift" in names             # every profile ends with the flatten


def test_dark_image_gets_tone_lift():
    """A low-contrast (dull/low-key) image gets the global tone lift, any profile."""
    flat = np.full((384, 384, 3), 90, np.uint8)  # very low contrast
    flat[100:280, 100:280] = 110
    recipe = build_recipe(analyze_image(flat))
    assert "tone_lift" in _step_names(recipe)


def test_chroma_bias_keeps_neutral_pixels_neutral():
    """A faintly-tinted grey must match a neutral LEGO color, not a saturated one."""
    from color_palette import LegoPalette
    pal = LegoPalette()
    tinted_grey = np.full((1, 1, 3), [120, 116, 128], np.uint8)  # slight purple cast
    cid = int(pal.match_image(tinted_grey)[0, 0])
    r, g, b = pal.get_rgb(cid)
    chroma = ((max(r, g, b) - min(r, g, b)))
    assert chroma < 45, f"matched a too-saturated color: {pal.get_color(cid)['name']} {r,g,b}"


def test_processing_is_deterministic():
    """Same bytes in → identical color grid out (preprocessing has no randomness)."""
    import processor
    buf = BytesIO()
    Image.fromarray(_studio_image()).save(buf, "PNG")
    data = buf.getvalue()
    g1 = processor.process_image(data, 32, 32)["grid"]
    g2 = processor.process_image(data, 32, 32)["grid"]
    assert g1 == g2


def test_real_images_route_correctly():
    """Only runs when the sample photos are present locally."""
    import processor
    cases = {"inputs/ktyb.jpg": "studio_portrait",
             "inputs/wedding.JPG": "busy_scene"}
    checked = 0
    for path, expected in cases.items():
        if not os.path.exists(path):
            continue
        data = open(path, "rb").read()
        prof = processor.process_image(data, 48, 48)["preprocessing"]["profile"]
        assert prof == expected, f"{path}: got {prof}, expected {expected}"
        checked += 1
    if checked == 0:
        print("  (skipped: no sample photos in inputs/)")


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn()
        print(f"PASS {fn.__name__}")
    print(f"\n{len(fns)} checks passed")
