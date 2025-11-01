export { auth as middleware } from "@/server/auth";

export const config = {
  matcher: [
    "/dashboard",
    "/daily-reports/:path*",
    "/tasks/:path*",
    "/settings",
  ],
};
