/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    if (!base) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${base}/:path*`,
      },
    ];
  },
};

export default nextConfig;
