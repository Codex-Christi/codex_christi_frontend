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
      {
        protocol: 'https',
        hostname: 'purecatamphetamine.github.io',
        pathname: '/country-flag-icons/3x2/**',
        search: '',
      },
      {
        protocol: 'https',
        hostname: 'mainmedia.codexchristi.org',
        pathname: '/**',
        search: '',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/next-api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
};

export default nextConfig;
