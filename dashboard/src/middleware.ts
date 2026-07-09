export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/content/:path*",
    "/api/pricing/:path*",
    "/api/sizes/:path*",
    "/api/palettes/:path*",
    "/api/parts/:path*",
    "/api/inventory/:path*",
    "/api/settings/:path*",
  ],
};
