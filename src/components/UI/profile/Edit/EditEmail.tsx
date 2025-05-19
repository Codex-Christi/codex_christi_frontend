"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const EditEmail = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("");

    return (
		<div className="grid gap-2">
			<button
				className="flex items-center gap-4 justify-between py-1"
				type="button"
				onClick={() => {
					setIsOpen(!isOpen);
					setActiveTab("email");
				}}
			>
				<span>Update Email</span>

				<svg
					className={cn({
						"rotate-90": isOpen,
					})}
					width="8"
					height="14"
					viewBox="0 0 8 14"
					fill="none"
				>
					<path
						d="M1.74928 1.18383C1.43686 0.871407 0.930328 0.871407 0.617908 1.18383C0.305489 1.49625 0.305489 2.00278 0.617908 2.3152L1.74928 1.18383ZM0.617908 2.3152L6.43456 8.13185L7.56593 7.00048L1.74928 1.18383L0.617908 2.3152Z"
						fill="white"
					/>
					<path
						d="M0.617908 11.6843C0.305489 11.9967 0.305489 12.5033 0.617908 12.8157C0.930328 13.1281 1.43686 13.1281 1.74928 12.8157L0.617908 11.6843ZM1.74928 12.8157L7.14092 7.42405L6.00955 6.29268L0.617908 11.6843L1.74928 12.8157Z"
						fill="white"
					/>
				</svg>
			</button>

			<label
				className={cn("grid gap-0.5", {
					"hidden": !isOpen || activeTab !== "email",
				})}
				htmlFor="email"
			>
				<span className="text-white/70">Enter new email address</span>

				<div className="grid gap-4 bg-inherit text-white">
					<div className="relative w-full">
						<span className="absolute top-[19px] left-3">
							<svg
								width="12"
								height="9"
								viewBox="0 0 12 9"
								fill="none"
							>
								<path
									fillRule="evenodd"
									clipRule="evenodd"
									d="M6 7.4844L0 2.18939V9H12V2.18939L6 7.4844ZM6.0006 5.88721L0 0.588611V0H12V0.588611L6.0006 5.88721Z"
									fill="#B6B6B6"
								/>
							</svg>
						</span>

						<input
							className="input w-full !pl-7"
							type="email"
							placeholder="Email address"
							id="email"
							name="email"
						/>
					</div>

					<button
						className="bg-white text-black font-semibold rounded py-2.5 px-5 mx-auto inline-flex items-center gap-2"
						type="button"
						onClick={() => setActiveTab("otp")}
					>
						Next{" "}
						<svg
							width="9"
							height="13"
							viewBox="0 0 9 13"
							fill="none"
						>
							<path
								d="M0.50001 11.2103C0.49892 11.5007 0.588488 11.7849 0.75736 12.0268C0.926232 12.2687 1.1668 12.4575 1.44858 12.5692C1.73035 12.6809 2.04064 12.7105 2.34011 12.6542C2.63958 12.5979 2.91475 12.4583 3.13073 12.2531L8.04826 7.56955C8.19214 7.43271 8.30606 7.27009 8.38343 7.09109C8.46081 6.91209 8.50011 6.72027 8.49905 6.52673C8.49905 6.50979 8.49905 6.49414 8.49905 6.4785C8.50646 6.27805 8.47039 6.0783 8.39306 5.89171C8.31574 5.70511 8.19883 5.53568 8.04964 5.39397L3.12936 0.72214C2.83791 0.458468 2.44968 0.313609 2.04753 0.318478C1.64537 0.323348 1.26114 0.47756 0.976837 0.748203C0.692536 1.01885 0.530681 1.38448 0.525815 1.76708C0.52095 2.14968 0.673459 2.51894 0.950795 2.79605L4.82837 6.48502L0.950795 10.174C0.807744 10.3101 0.694297 10.4716 0.616946 10.6494C0.539596 10.8273 0.499859 11.0178 0.50001 11.2103Z"
								fill="black"
							/>
						</svg>
					</button>
				</div>
			</label>

			<label
				className={cn("grid gap-0.5", {
					"hidden": !isOpen || activeTab !== "otp",
				})}
				htmlFor="otp"
			>
				<span className="text-white/70">
					A code has been sent to your new email
				</span>

				<div className="grid gap-4 bg-inherit text-white">
					<div className="relative w-full">
						<span className="absolute top-[16px] left-3">
							<svg
								width="11"
								height="16"
								viewBox="0 0 11 16"
								fill="none"
							>
								<path
									fillRule="evenodd"
									clipRule="evenodd"
									d="M1.77542 3.88362C1.77542 1.8282 3.4499 0.15918 5.49986 0.15918H5.50014C7.54995 0.15918 9.22458 1.82811 9.22458 3.88362V6.30313C10.3111 7.30552 11 8.74501 11 10.3412C11 13.3713 8.53568 15.8412 5.5 15.8412C2.46432 15.8412 0 13.3712 0 10.3412C0 8.74504 0.68888 7.30567 1.77542 6.30313V3.88362ZM5.49986 4.84135C6.44074 4.84135 7.32564 5.07656 8.10415 5.49662V3.88362C8.10415 2.44428 6.93361 1.27932 5.49986 1.27932C4.06611 1.27932 2.89557 2.44424 2.89557 3.88362V5.49662C3.67393 5.07658 4.55897 4.84135 5.49986 4.84135Z"
									fill="white"
									fillOpacity="0.7"
								/>
							</svg>
						</span>

						<input
							className="input w-full !pl-7"
							type="email"
							placeholder="Enter code"
							id="otp"
							name="otp"
						/>
					</div>

					<button
						className="bg-[#0085FF] text-white font-semibold rounded py-2.5 px-5 mx-auto block"
                        type="button"
                        onClick={() => {
                            setActiveTab("");
                            setIsOpen(false);
                        }}
					>
						Save
					</button>
				</div>
			</label>
		</div>
	);
};

export default EditEmail;
