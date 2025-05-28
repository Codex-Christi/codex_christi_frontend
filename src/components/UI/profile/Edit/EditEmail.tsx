/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const EditEmail = ({
	onChange,
	value,
}: {
	onChange: (e: any) => void;
	value: string | null | number;
}) => {
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
					hidden: !isOpen || activeTab !== "email",
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
							type="emails"
							placeholder="Email address"
							id="email"
							name="email"
                            value={String(value)}
                            onChange={(e) => onChange(e.target.value)}
						/>
					</div>
				</div>
			</label>
		</div>
	);
};

export default EditEmail;
