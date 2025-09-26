// @ts-check

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /* config options here */
  // output: 'standalone',
  productionBrowserSourceMaps: false,
  compiler: {
    // Uncomment if you want to remove logs from production server
    // removeConsole: process.env.NODE_ENV === 'production',
  },
  serverExternalPackages: ['pdfkit'],
  images: {
    remotePatterns: [
      new URL('https://avatar.iran.liara.run/public/**'),
      new URL('https://d2dytk4tvgwhb4.cloudfront.net/**'),
      new URL('https://mainmedia.codexchristi.org/**'),
      new URL('https://purecatamphetamine.github.io/country-flag-icons/3x2/**'),
    ],
    qualities: [25, 50, 75, 100],
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
