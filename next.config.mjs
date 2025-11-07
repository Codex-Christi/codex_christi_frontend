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
    deviceSizes: [320, 375, 425, 512, 640, 768, 900], // drop 1024, 1280 for gallery, // remove very large variants for gallery

    // small sizes for thumbnails, icons, small images
    imageSizes: [24, 48, 80, 120, 160, 240, 320, 400, 480], // added 400 and 480 for better intermediate thumbnails
    qualities: [25, 50, 75, 80, 90, 100],
    formats: ['image/avif', 'image/webp'],
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
