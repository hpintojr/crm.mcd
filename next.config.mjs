/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server-only secrets are read via process.env in server code; never expose to the client.
};

export default nextConfig;
