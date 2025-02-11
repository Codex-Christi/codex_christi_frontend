// @ts-check

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /* config options here */
  // output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatar.iran.liara.run',
        port: '',
        pathname: '/public/**',
        search: '',
      },
    ],
  },
};

export default nextConfig;
