"use client";

import Image from "next/image";
import NotFoundImage from "@/assets/img/shop-not-found.png";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/UI/primitives/button";

export default function NotFound() {
    const { push } = useRouter();

	return (
		<div className="!relative py-12 flex flex-col justify-between place-content-center gap-4 min-h-dvh w-full bg-transparent !select-none">
			<div className="mx-auto text-center grid gap-2">
				<div className="w-[200px] md:w-[350px] md:h-[200px]">
					<Image
						className="size-full"
						src={NotFoundImage}
						alt="Product not Found!"
					/>
				</div>

				<div className="text-center">
					<p>...ooops</p>

					<h1 className="text-lg">Product not Found!</h1>
				</div>
			</div>

			<motion.div
				whileHover={{ scale: 1.05 }}
				whileTap={{ scale: 0.95 }}
				className="flex justify-center"
			>
				<Button
					name="Return to shop home button"
					variant="outline"
					className="bg-transparent border-[#0085FF] text-white bg-[#0085FF] hover:bg-[#0085FF]/70 hover:text-white font-ocr !font-bold px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base"
					onClick={() => push("/shop")}
				>
					Return to Home
				</Button>
			</motion.div>
		</div>
	);
}
