import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Inter, Trade_Winds } from "next/font/google";
import { cn } from "@/lib/utils";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import ResponsiveMediaProvider from "@/components/UI/Providers/ResponsiveMediaQueryProvider";
import LoggedinProvider from "@/components/UI/Providers/LoggedinProvider";

// Components Import
import FaviconUpdater from "@/components/UI/general/Helpers/FaviconUpdater";

const nicoMoji = localFont({
	src: "../res/fonts/Nico-Moji.woff",
	variable: "--font-nico",
});
const OCR_ext = localFont({
	src: "../res/fonts/OCR-ext.ttf",
	variable: "--font-ocr",
});
const InterFont = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
});
const TradeWinds = Trade_Winds({
	subsets: ["latin"],
	variable: "--font-trade-winds",
	weight: ["400"],
});

export async function generateMetadata(): Promise<Metadata> {
	return {
		// dynamically get the host from the Next headers
		metadataBase: new URL(`https://${(await headers()).get("host")}`),
		title: "Codex Christi",
		description:
			"A Hub for Christian Creatives to connect, share, and glorify God.",
	};
}

export const viewport: Viewport = {
	initialScale: 1,
	viewportFit: "cover",
	width: "device-width",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	// Main HTML Document
	return (
		<html
			lang="en"
			className="!overflow-x-hidden !overflow-y-auto "
		>
			{/* !w-screen */}
			<body
				className={cn(
					` font-inter bg-black text-white !max-w-full !overflow-x-hidden antialiased`,
					nicoMoji.variable,
					OCR_ext.variable,
					InterFont.variable,
					TradeWinds.variable,
				)}
			>
				<FaviconUpdater />
				<Toaster richColors />
				<ResponsiveMediaProvider>
					<LoggedinProvider>{children}</LoggedinProvider>
				</ResponsiveMediaProvider>
			</body>
		</html>
	);
}
