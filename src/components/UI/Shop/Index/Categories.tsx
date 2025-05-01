import Image from "next/image";
import BlackHoodie from "@/assets/img/section-1-black.png";
import WhiteHoodie from "@/assets/img/section-1-white.png";
import YellowHoodie from "@/assets/img/section-1-yellow.png";
import SneakerOne from "@/assets/img/sneakers-1.png";
import SneakerTwo from "@/assets/img/sneakers-2.png";
import SneakerThree from "@/assets/img/sneakers-3.png";
import Mug from "@/assets/img/mug.png";
import Bag from "@/assets/img/bag.png";
import BookHeap from "@/assets/img/book-heap.png";
import Book from "@/assets/img/book.png";
import TshirtOne from "@/assets/img/t-shirt-1.png";
import TshirtTwo from "@/assets/img/t-shirt-2.png";
import CapOne from "@/assets/img/cap-1.png";
import CapTwo from "@/assets/img/cap-2.png";
import CapThree from "@/assets/img/cap-3.png";
import SpecialsHoodie from "@/assets/img/specials-hoodie.png";
import SpecialsTshirt from "@/assets/img/specials-t-shirt.png";

const Categories = () => {
	return (
		<div className="space-y-8">
			<h2 className="font-extrabold text-white text-2xl px-8">
				Explore Top Categories
			</h2>

			<div className="max-md:flex overflow-x-auto md:grid md:grid-cols-2 gap-4 md:gap-8 items-start lg:gap-12 rounded-[20px]">
				<div className="max-md:min-w-[90%] grid gap-4 md:gap-8">
					<div className="grid gap-4 md:gap-8 md:grid-cols-12">
						<div className="space-y-4 md:space-y-8 md:col-span-7">
							<div className="bg-[linear-gradient(161.11deg,_rgba(0,_133,_255,_0.7)_6.84%,_rgba(0,_24,_140,_0.5)_49.48%,_rgba(8,_8,_8,_0.7)_92.13%)] p-4 md:p-8 rounded-[20px] space-y-4">
								<div className="flex items-center gap-4 justify-between">
									<p className="font-extrabold text-xl">
										Hoodies
									</p>

									<div>
										<Image
											src={BlackHoodie}
											alt="Black hoodie"
										/>

										<p className="font-bold text-center">
											N7,999
										</p>
									</div>
								</div>

								<div className="flex items-center justify-between">
									<div>
										<Image
											src={WhiteHoodie}
											alt="White hoodie"
										/>

										<p className="font-bold -mt-4 text-center">
											N7,999
										</p>
									</div>

									<div>
										<Image
											src={YellowHoodie}
											alt="Yellow hoodie"
										/>

										<p className="font-bold text-center">
											N7,999
										</p>
									</div>
								</div>
							</div>

							<div className="bg-[linear-gradient(129.23deg,_rgba(0,_133,_255,_0.7)_15.65%,_rgba(0,_24,_140,_0.5)_51.1%,_rgba(8,_8,_8,_0.7)_86.55%)] p-12 rounded-[20px] flex items-center gap-4 justify-between">
								<p className="font-extrabold text-xl">Mugs</p>

								<div>
									<Image
										src={Mug}
										alt="Mug"
									/>

									<p className="font-bold text-center">
										N7,999
									</p>
								</div>
							</div>
						</div>

						<div className="bg-[linear-gradient(161.11deg,_rgba(0,_133,_255,_0.7)_6.84%,_rgba(0,_24,_140,_0.5)_49.48%,_rgba(8,_8,_8,_0.7)_92.13%)] p-4 rounded-[20px] md:p-8 md:col-span-5 space-y-4">
							<p className="font-extrabold text-xl text-center">
								Sneakers
							</p>

							<div className="grid place-content-center gap-4 md:gap-8">
								<div>
									<Image
										className="mx-auto"
										src={SneakerOne}
										alt="Sneaker One"
									/>

									<p className="font-bold text-center">
										N7,999
									</p>
								</div>

								<div>
									<Image
										className="mx-auto"
										src={SneakerTwo}
										alt="Sneaker Two"
									/>

									<p className="font-bold text-center">
										N7,999
									</p>
								</div>

								<div>
									<Image
										className="mx-auto"
										src={SneakerThree}
										alt="Sneaker Three"
									/>

									<p className="font-bold text-center">
										N7,999
									</p>
								</div>
							</div>
						</div>
					</div>

					<div className="bg-[linear-gradient(129.23deg,_rgba(0,_133,_255,_0.7)_15.65%,_rgba(0,_24,_140,_0.5)_51.1%,_rgba(8,_8,_8,_0.7)_86.55%)] p-4 md:p-8 rounded-[20px] grid items-center gap-4 md:grid-cols-12">
						<p className="font-extrabold text-2xl md:col-span-4">
							Back to School supplies
						</p>

						<div className="flex items-center gap-4 md:col-span-8">
							<div>
								<Image
									className="mx-auto"
									src={Bag}
									alt="Bag"
								/>

								<p className="font-bold text-center">N7,999</p>
							</div>

							<div>
								<Image
									className="mx-auto"
									src={BookHeap}
									alt="BookHeap"
								/>

								<p className="font-bold text-center">N7,999</p>
							</div>

							<div>
								<Image
									className="mx-auto"
									src={Book}
									alt="Book"
								/>

								<p className="font-bold text-center">N7,999</p>
							</div>
						</div>
					</div>
				</div>

				<div className="max-md:min-w-[90%] grid gap-4 md:gap-8">
					<div className="grid gap-4 md:gap-8 items-start md:grid-cols-12">
						<div className="bg-[linear-gradient(161.11deg,_rgba(0,_133,_255,_0.7)_6.84%,_rgba(0,_24,_140,_0.5)_49.48%,_rgba(8,_8,_8,_0.7)_92.13%)] p-4 md:p-8 space-y-4 rounded-[20px] md:col-span-7">
							<div className="flex items-center gap-4 justify-between">
								<p className="font-extrabold text-xl">
									T-Shirts
								</p>

								<div>
									<Image
										src={TshirtOne}
										alt="T-Shirts"
									/>

									<p className="font-bold text-center">
										N7,999
									</p>
								</div>
							</div>

							<div>
								<Image
									src={TshirtTwo}
									alt="T-Shirts"
								/>

								<p className="font-bold text-center">
									from N5,000
								</p>
							</div>
						</div>

						<div className="bg-[linear-gradient(161.11deg,_rgba(0,_133,_255,_0.7)_6.84%,_rgba(0,_24,_140,_0.5)_49.48%,_rgba(8,_8,_8,_0.7)_92.13%)] p-12 rounded-[20px] space-y-4 md:col-span-5">
							<p className="font-extrabold text-xl text-center">
								Headwears
							</p>

							<div className="grid place-content-center gap-4 md:gap-8">
								<div>
									<Image
										className="mx-auto"
										src={CapOne}
										alt="Cap One"
									/>

									<p className="font-bold text-center">
										N7,999
									</p>
								</div>

								<div>
									<Image
										className="mx-auto"
										src={CapTwo}
										alt="Cap Two"
									/>

									<p className="font-bold text-center">
										N7,999
									</p>
								</div>

								<div>
									<Image
										className="mx-auto"
										src={CapThree}
										alt="Cap Three"
									/>

									<p className="font-bold text-center">
										N7,999
									</p>
								</div>
							</div>
						</div>
					</div>

					<div className="bg-[linear-gradient(129.23deg,_rgba(0,_133,_255,_0.7)_15.65%,_rgba(0,_24,_140,_0.5)_51.1%,_rgba(8,_8,_8,_0.7)_86.55%)] p-4 md:p-8 rounded-[20px] grid items-center gap-4 md:grid-cols-12">
						<p className="font-extrabold text-2xl md:col-span-4">
							<span className="flex items-center gap-2 mb-2">
								{Array.from({ length: 3 }).map((_, index) => (
									<svg
										key={index}
										width="25"
										height="24"
										viewBox="0 0 25 24"
										fill="none"
									>
										<path
											d="M12.6543 0.188232L16.3223 7.75623L24.6543 8.90723L18.5903 14.7352L20.0703 23.0142L12.6543 19.0472L5.2373 23.0142L6.7183 14.7352L0.654297 8.90723L8.9863 7.75623L12.6543 0.188232Z"
											fill="white"
										/>
									</svg>
								))}
							</span>
							TODAY’S SPECIALS (3)
						</p>

						<div className="flex items-center justify-between gap-4 md:col-span-8">
							<div>
								<Image
									className="mx-auto"
									src={SpecialsHoodie}
									alt="Bag"
								/>

								<p className="font-bold text-center">N7,999</p>
							</div>

							<div>
								<Image
									className="mx-auto"
									src={SpecialsTshirt}
									alt="BookHeap"
								/>

								<p className="font-bold text-center">N7,999</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Categories;
