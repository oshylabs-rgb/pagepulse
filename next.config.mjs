/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000', 'pagepulse.io', 'www.pagepulse.io'] },
  },
}

export default nextConfig
