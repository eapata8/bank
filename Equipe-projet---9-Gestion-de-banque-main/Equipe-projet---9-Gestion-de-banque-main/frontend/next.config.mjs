import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "http://localhost:5000";

const normalizedBackendUrl = backendUrl.endsWith("/")
  ? backendUrl.slice(0, -1)
  : backendUrl;

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${normalizedBackendUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${normalizedBackendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
