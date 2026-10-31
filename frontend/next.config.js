/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {},
  images: {
    domains: ["ipfs.io", "gateway.ipfs.io"],
  },
}

module.exports = nextConfig
