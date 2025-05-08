"use client";

import Image from "next/image";
import PayPal from "@/assets/img/paypal.png";
import GooglePay from "@/assets/img/gpay.png";
import SupportedCards from "@/assets/img/suppoted-cards.png";
import ProductImage from "@/assets/img/t-shirt-2.png";
import Link from "next/link";
import { Checkbox } from "@/components/UI/primitives/checkbox";
import { useState } from "react";
import { Button } from "@/components/UI/primitives/button";

const CheckoutPage = () => {
	const [payOption, setPayOption] = useState("");

	return (
		<div className="grid gap-8 items-start px-2 py-12 md:px-[20px] lg:px-[24px] md:grid-cols-2 lg:grid-cols-12">
			<div className="bg-[#3D3D3D4D] backdrop-blur-[20px] p-4 rounded-[10px] md:p-10 space-y-8 lg:col-span-7">
				<h2 className="border-b border-white pb-1 text-xl font-bold">
					Payment Method
				</h2>

				<div className="grid gap-8">
					<div className="space-y-4">
						<p className="text-lg font-bold">Pay with:</p>

						<div className="flex items-center gap-8 flex-wrap">
							<p className="flex items-center gap-2">
								<Checkbox
									className={`w-[1.15rem] h-[1.15rem] border-white text-white`}
									checked={payOption === "card"}
									onCheckedChange={() => setPayOption("card")}
								/>
								Credit/Debit Card
							</p>

							<p className="flex items-center gap-3">
								<Checkbox
									className={`w-[1.15rem] h-[1.15rem] border-white text-white`}
									checked={payOption === "paypal"}
									onCheckedChange={() =>
										setPayOption("paypal")
									}
								/>

								<Image
									className="w-10 h-auto"
									src={PayPal}
									alt="Pay with Paypal"
								/>
							</p>

							<p className="flex items-center gap-3">
								<Checkbox
									className={`w-[1.15rem] h-[1.15rem] border-white text-white`}
									checked={payOption === "google pay"}
									onCheckedChange={() =>
										setPayOption("google pay")
									}
								/>

								<Image
									className="w-10 h-auto"
									src={GooglePay}
									alt="Pay with Google Pay"
								/>
							</p>
						</div>
					</div>

					<div className="grid gap-6">
						<p>
							Create your account Or{" "}
							<span className="font-medium">
								Already have an account?{" "}
								<Link
									className="underline underline-offset-4 font-semibold"
									href=""
								>
									Sign In
								</Link>
							</span>
						</p>

						<label
							className="grid gap-1"
							htmlFor="cardNumber"
						>
							<span>Card Number</span>

							<div className="bg-inherit relative text-white">
								<Image
									className="absolute w-20 h-auto top-1/3 right-3"
									src={SupportedCards}
									alt="Cards we support"
									quality={100}
								/>

								<input
									className="input w-full !pr-24 !rounded-[10px]"
									type="text"
									placeholder="0123 4567 8901 2345"
									id="cardNumber"
									name="cardNumber"
								/>
							</div>
						</label>

						<div className="grid gap-6 items-start md:grid-cols-2">
							<label
								className="grid gap-1"
								htmlFor="expiryDate"
							>
								<span>Expiration Date</span>

								<div className="grid gap-4 bg-inherit text-white">
									<input
										className="input w-full !px-4 !py-2.5 !rounded-[10px]"
										type="date"
										placeholder="MM/YY"
										id="expiryDate"
										name="expiryDate"
									/>
								</div>
							</label>

							<label
								className="grid gap-1"
								htmlFor="cvv"
							>
								<span>CVV</span>

								<div className="grid gap-4 bg-inherit text-white">
									<input
										className="input w-full !px-4 !py-2.5 !rounded-[10px]"
										type="number"
										placeholder="CVV"
										id="cvv"
										name="cvv"
									/>
								</div>
							</label>
						</div>

						<div className="space-y-2">
							<p className="flex items-center gap-2 text-[#F3F3F399]">
								<Checkbox
									className={`w-[1.15rem] h-[1.15rem] border-white text-white`}
									// checked={}
									// onCheckedChange={}
								/>
								Save card details
							</p>

							<p className="flex items-center gap-2">
								<Checkbox
									className={`w-[1.15rem] h-[1.15rem] border-white text-white`}
									// checked={}
									// onCheckedChange={}
								/>
								I have read and agreed with the website’s{" "}
								<Link
									className="underline underline-offset-4 font-semibold"
									href=""
									target="_blank"
									rel="noopener noreferrer"
								>
									Terms and Conditions
								</Link>
							</p>
						</div>

						<Button
							name="Return to shop home button"
							variant="outline"
							className="border-[#0085FF] text-white bg-[#0085FF] hover:bg-[#0085FF]/70 hover:text-white !font-bold px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-center"
						>
							Pay N11,900
						</Button>
					</div>
				</div>
			</div>

			<div className="bg-[#3D3D3D4D] backdrop-blur-[20px] p-4 rounded-[10px] md:p-10 space-y-8 lg:col-span-5">
				<h2 className="border-b border-white pb-1 text-xl font-bold">
					Order Summary
				</h2>

				<div className="grid gap-12">
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-center gap-4">
							<Image
								className="rounded-[10px] w-10 h-12 object-cover object-center"
								src={ProductImage}
								alt="Ton blue hoodie "
							/>

							<div className="text-[#F3F3F3] text-sm space-y-0.5">
								<p className="font-semibold">Ton blue hoodie</p>

								<p className="text-[#F3F3F3]/70">Size: M</p>

								<p className="text-[#F3F3F3]/70">Colour: Ton Blue</p>
							</div>
						</div>

						<div className="text-[#F3F3F3] space-y-0.5">
							<p className="font-semibold">N34,700</p>

							<p className="text-right text-[#F3F3F3]/70">Qty: 3</p>
						</div>
					</div>

					<div className="flex items-start gap-3">
						<input
							className="input w-full !px-4 !py-2.5 !rounded-[10px] !border-[#F3F3F399]"
							type="text"
							placeholder="Coupon or discount code"
							id="coupon"
							name="coupon"
						/>

						<button className="btn border-[#F3F3F366] text-[#F3F3F3] bg-[#F3F3F366] hover:bg-[#F3F3F366]/30 hover:text-[#F3F3F3] !font-bold px-4 sm:px-6 !py-2.5 rounded-[10px] text-sm sm:text-base text-center shrink-0">
							Apply
						</button>
					</div>

					<div className="space-y-2">
						<p className="flex items-center justify-between gap-4 font-semibold">
							<span>Subtotal</span>

							<span>N34,700</span>
						</p>

						<p className="flex items-center justify-between gap-4 font-semibold">
							<span>Shipping/Delivery Fee</span>

							<span>N3,000</span>
						</p>
					</div>

					<p className="flex items-center justify-between gap-4 font-semibold">
						<span>Total</span>

						<span className="text-lg">N37,700</span>
					</p>
				</div>
			</div>
		</div>
	);
};

export default CheckoutPage;
