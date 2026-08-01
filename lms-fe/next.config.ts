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
  // Emit a self-contained server bundle for the Docker runtime image
  // (see lms-fe/Dockerfile stage 3).
  output: "standalone",
  // The vendored Mattermost client packages (src/chat/platform/{client,types})
  // ship pre-built CommonJS. Transpile them through SWC so Next can bundle
  // them for the browser and resolve CJS interop. Both are linked as local
  // file: deps in package.json — see the chat feature (src/lib/chat, src/components/lms/chat).
  transpilePackages: ["@mattermost/client", "@mattermost/types"],
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
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8065"
    return [
      {
        source: "/api/v4/:path*",
        destination: `${backendUrl}/api/v4/:path*`,
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
