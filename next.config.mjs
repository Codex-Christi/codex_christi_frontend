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
      new URL('https://d2dytk4tvgwhb4.cloudfront.net/v2/**'),
      new URL('https://d2dytk4tvgwhb4.cloudfront.net/**'),
      new URL('https://mainmedia.codexchristi.org/**'),
      new URL('https://purecatamphetamine.github.io/country-flag-icons/3x2/**'),
      {
        protocol: 'https',
        hostname: 'd2dytk4tvgwhb4.cloudfront.net', // Replace with your actual CloudFront domain
        port: '', // Leave empty unless a specific port is used
        pathname: '/**', // This wildcard allows any path and implicitly any query parameters
      },
    ],
    // cover viewport widths your app uses
    deviceSizes: [320, 375, 425, 768, 1024, 1280, 1440, 1920, 2048],
    // small sizes for thumbnails, icons, small images
    imageSizes: [24, 48, 80, 120, 160, 240, 320],
    qualities: [25, 50, 75, 80, 90, 100],
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
