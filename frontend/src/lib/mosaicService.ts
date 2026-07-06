
type BackendService = "brickmos" | "mosaic-generator" | "backend";

/**
 * Chooses which mosaic-generation backend to call: the Python `backend/`
 * FastAPI service (full brick-fitting pipeline) or the `brickmos/` upload
 * service (simpler 1x1-stud mosaic generator).
 *
 * Controlled by the `MOSAIC_SERVICE` environment variable:
 *   - "backend"  (default) -> PYTHON_API_URL   (default http://localhost:8000)
 *   - "brickmos"           -> BRICKMOS_API_URL (default http://localhost:8001)
 *   - "mosaic-generator"   -> MOSAIC_GENERATOR_API_URL (default http://localhost:8002)
 */
export function getMosaicServiceUrl(): string {
  const service = (process.env.MOSAIC_SERVICE ?? "backend").toLowerCase() as BackendService;

  switch (service) {
    case "brickmos":
      return process.env.BRICKMOS_API_URL ?? "http://localhost:8001";

    case "mosaic-generator":
      return process.env.MOSAIC_GENERATOR_API_URL ?? "http://localhost:8002";

    case "backend":
    default:
      return process.env.PYTHON_API_URL ?? "http://localhost:8000";
  }
}
