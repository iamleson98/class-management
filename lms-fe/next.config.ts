import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-9aca490e-52af-473b-8628-030809f44879.space-z.ai",
    "*.space-z.ai",
  ],
  // Proxy API requests to the backend so the auth flow stays same-origin.
  //
  // Auth is via the httpOnly MMAUTHTOKEN cookie the backend sets at login. The
  // proxy makes /api/v4/* on the frontend origin resolve to the backend, which
  // keeps the cookie FIRST-PARTY — so SameSite=Lax (the backend default) works
  // and we never need SameSite=None;Secure (which would force HTTPS even in dev).
  //
  // This rewrite is load-bearing for auth: removing it breaks the cookie model.
  // In production, achieve the same effect by serving frontend + backend under
  // one domain (or a reverse proxy) instead of this Next.js rewrite.
  async rewrites() {
    return [
      {
        source: "/api/v4/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8065"}/api/v4/:path*`,
      },
    ];
  },
  // Ensure cookies are properly forwarded in development
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
