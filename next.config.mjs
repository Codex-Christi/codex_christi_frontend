// @ts-check

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.1.231', '127.0.0.1'],
  compiler: {
    // Uncomment if you want to remove logs from production server
    // removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    remotePatterns: [
      new URL('https://avatar.iran.liara.run/public/**'),
      new URL('https://d2dytk4tvgwhb4.cloudfront.net/v2/**'),
      new URL('https://d2dytk4tvgwhb4.cloudfront.net/**'),
      new URL('https://mainmedia.codexchristi.org/**'),
      new URL('https://merchize.com/wp-content/uploads/**'),
      new URL('https://www.merchize.com/wp-content/uploads/**'),
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
    minimumCacheTTL: 60 * 60 * 24 * 365,
    qualities: [25, 50, 75, 80, 90, 100],
    formats: ['image/avif', 'image/webp'],
  },
  logging: {
    fetches: { fullUrl: true },
    // browserToTerminal: true, // Forwards logs with file/line info to the terminal
  },
  output: 'standalone',
  productionBrowserSourceMaps: false,
  serverExternalPackages: ['pdfkit'],

  // Func-based configs
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
