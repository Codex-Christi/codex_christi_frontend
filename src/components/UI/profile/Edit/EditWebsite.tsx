"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const EditWebsite = () => {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="grid gap-2">
			<button
				className="flex items-center gap-4 justify-between py-1"
				type="button"
				onClick={() => {
					setIsOpen(!isOpen);
				}}
			>
				<span>Add Website</span>

				<svg
					width="22"
					height="22"
					viewBox="0 0 22 22"
					fill="none"
				>
					<path
						d="M13.4028 18.2085L12.6019 19.0094C9.94782 21.6636 5.64468 21.6636 2.99058 19.0094C0.336475 16.3554 0.336475 12.0522 2.99058 9.39817L3.79152 8.59717"
						stroke="#F3F3F3"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<path
						d="M8.59717 13.4029L13.4029 8.59717"
						stroke="#F3F3F3"
						strokeWidth="2"
						strokeLinecap="round"
					/>
					<path
						d="M8.59717 3.79152L9.39817 2.99058C12.0522 0.336475 16.3554 0.336475 19.0094 2.99058C21.6636 5.64468 21.6636 9.94782 19.0094 12.6019L18.2085 13.4028"
						stroke="#F3F3F3"
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			</button>

			<label
				className={cn("grid gap-0.5", {
					hidden: !isOpen,
				})}
				htmlFor="website"
			>
				<div className="grid gap-4 bg-inherit text-white">
					<div className="relative w-full">
						<span className="absolute top-[10px] right-3">
							<svg
								width="23"
								height="22"
								viewBox="0 0 23 22"
								fill="none"
							>
								<path
									d="M13.9028 18.2081L13.1019 19.009C10.4478 21.6631 6.14468 21.6631 3.49058 19.009C0.836475 16.3549 0.836475 12.0517 3.49058 9.39768L4.29152 8.59668"
									stroke="#F3F3F3"
									strokeWidth="2"
									strokeLinecap="round"
								/>
								<path
									d="M9.09717 13.4024L13.9029 8.59668"
									stroke="#F3F3F3"
									strokeWidth="2"
									strokeLinecap="round"
								/>
								<path
									d="M9.09717 3.79152L9.89817 2.99058C12.5522 0.336475 16.8554 0.336475 19.5094 2.99058C22.1636 5.64468 22.1636 9.94782 19.5094 12.6019L18.7085 13.4028"
									stroke="#F3F3F3"
									strokeWidth="2"
									strokeLinecap="round"
								/>
							</svg>
						</span>

						<input
							className="input w-full !pr-10"
							type="url"
							defaultValue="https://"
							placeholder="https://example.com"
							id="website"
							name="website"
						/>
					</div>

					<button
						className="bg-[#0085FF] text-white font-semibold rounded py-2.5 px-5 mx-auto block"
						type="button"
						onClick={() => {
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

export default EditWebsite;
