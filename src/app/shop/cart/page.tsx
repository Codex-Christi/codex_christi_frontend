import Link from "next/link";
import Image from "next/image";
import CartImage from "@/assets/img/cart-image.png";
import Calendar from "@/assets/img/calendar.png";

const Cart = () => {
	return (
		<div className="pb-12">
			<div className="px-2 py-12 md:px-[20px] lg:px-[24px]">
				<div className="bg-[#3D3D3D4D] text-white rounded-[20px] grid place-content-center gap-4 min-h-[60svh] w-full py-12">
					<div className="w-32 h-auto mx-auto">
						<Image
							src={CartImage}
							alt=""
						/>
					</div>

					<div className="space-y-2 text-center">
						<h2 className="font-semibold">Your cart is empty!</h2>

						<p>Discover the best deals here</p>

						<Link
							className="text-center bg-[#0085FF] px-4 py-3 rounded-lg text-white font-extrabold inline-flex items-center gap-4"
							href=""
						>
							START SHOPPING
							<svg
								width="6"
								height="10"
								viewBox="0 0 6 10"
								fill="none"
							>
								<path
									d="M7.37392e-06 8.83806C-0.000810145 9.067 0.066366 9.29103 0.19302 9.48175C0.319674 9.67247 0.500102 9.82129 0.711433 9.90934C0.922765 9.9974 1.15548 10.0207 1.38009 9.97636C1.60469 9.932 1.81106 9.82195 1.97305 9.66016L5.6612 5.9679C5.7691 5.86003 5.85454 5.73182 5.91257 5.59071C5.97061 5.4496 6.00008 5.29838 5.99929 5.1458C5.99929 5.13244 5.99929 5.12011 5.99929 5.10778C6.00485 4.94976 5.97779 4.79229 5.9198 4.64518C5.86181 4.49808 5.77413 4.36451 5.66223 4.2528L1.97202 0.569783C1.75343 0.361919 1.46226 0.24772 1.16064 0.251559C0.859026 0.255397 0.570854 0.37697 0.357628 0.59033C0.144402 0.80369 0.0230107 1.09194 0.0193616 1.39356C0.0157126 1.69518 0.130095 1.98628 0.338096 2.20474L3.24628 5.11292L0.338096 8.0211C0.230808 8.12837 0.145723 8.25574 0.0877098 8.39592C0.0296967 8.5361 -0.000105819 8.68635 7.37392e-06 8.83806Z"
									fill="white"
								/>
							</svg>
						</Link>
					</div>
				</div>
			</div>

			<div className="space-y-8 mt-4 md:col-span-2">
				<h2 className="font-extrabold text-white text-2xl px-8">
					You might also like
				</h2>

				<div className="bg-[#3D3D3D4D] grid grid-cols-2 gap-8 md:gap-12 px-2 py-10 md:px-8 lg:px-16 text-white md:grid-cols-3 lg:grid-cols-6 items-start justify-between flex-wrap">
					{Array.from({ length: 6 }).map((_, index) => (
						<div
							className="rounded-lg"
							key={index}
						>
							<Image
								className="rounded-t-lg w-full"
								src={Calendar}
								alt="Item"
							/>

							<div className="border-x border-b rounded-b-lg border-white space-y-3 p-2">
								<div className="space-y-2">
									<p className="font-normal">
										2024 Calender with Bible verses
									</p>

									<p className="flex items-center justify-between gap-4">
										<span className="font-bold text-sm">
											N2000
										</span>

										<span className="text-xs line-through">
											N2,500
										</span>
									</p>
								</div>

								<div className="grid place-content-center">
									<Link
										className="text-sm border border-white font-bold p-2 rounded-full inline-block w-auto"
										href=""
									>
										View item
									</Link>
								</div>
							</div>
						</div>
					))}
				</div>

				<div className="grid place-content-center gap-4">
					<p>Please tell us what you think.</p>

					<Link
						className="text-center bg-[#0085FF] px-4 py-3 rounded-lg text-white"
						href=""
					>
						Kindly give us a feedback!
					</Link>
				</div>
			</div>
		</div>
	);
};

export default Cart;
