/** @type {import('next').NextConfig} */

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://192.168.1.140:3000",
    "http://192.168.0.147:3000", // tu PC actual
    // Agrega aquí la IP de cualquier dispositivo cliente, por ejemplo:
    // "http://192.168.0.150:3000"
  ],
}

export default nextConfig
