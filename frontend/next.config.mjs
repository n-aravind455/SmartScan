/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow LocalTunnel subdomain, Cloudflare tunnel, and LAN IP to connect
  allowedDevOrigins: [
    'spinning-ring-xyz.loca.lt',
    '*.loca.lt',
    '*.trycloudflare.com',
    'entertaining-videos-packs-shipments.trycloudflare.com',
    '192.168.0.36',
    '192.168.29.187',
  ],
  
  // Proxy API requests to the FastAPI backend during development
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const minioUrl = process.env.MINIO_URL || "http://minio:9000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/minio/:path*",
        destination: `${minioUrl}/:path*`,
      },
    ];
  },

  // Allow images from MinIO
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
      {
        protocol: "http",
        hostname: "minio",
        port: "9000",
      },
    ],
  },
};

export default nextConfig;
