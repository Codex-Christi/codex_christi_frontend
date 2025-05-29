/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function EditBirthday({
	onChange,
	value,
}: {
	onChange: (e: any) => void;
	value: string | null | number;
}) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState("")

	return (
		<div className="grid gap-2">
			<button
				className="flex items-center gap-4 justify-between py-1"
				type="button"
				onClick={() => {
					setIsOpen(!isOpen);
					setActiveTab("birthday");
				}}
			>
				{value ? (
					format(String(value), "PPP")
				) : (
					<span>Add Birthday</span>
				)}

				<svg
					width="22"
					height="22"
					viewBox="0 0 22 22"
					fill="none"
				>
					<path
						d="M1 7.66667H21M5.44444 1V3.22222M16.5556 1V3.22222M4.33333 12.1111H6.55555M4.33333 16.5556H6.55555M9.88889 12.1111H12.1111M9.88889 16.5556H12.1111M15.4444 12.1111H17.6667M15.4444 16.5556H17.6667M4.55555 21H17.4444C18.689 21 19.3113 21 19.7867 20.7578C20.2048 20.5448 20.5448 20.2048 20.7578 19.7867C21 19.3113 21 18.689 21 17.4444V6.77778C21 5.53321 21 4.91093 20.7578 4.43558C20.5448 4.01743 20.2048 3.67748 19.7867 3.46443C19.3113 3.22222 18.689 3.22222 17.4444 3.22222H4.55555C3.311 3.22222 2.68871 3.22222 2.21336 3.46443C1.79521 3.67748 1.45526 4.01743 1.24221 4.43558C1 4.91093 1 5.53321 1 6.77778V17.4444C1 18.689 1 19.3113 1.24221 19.7867C1.45526 20.2048 1.79521 20.5448 2.21336 20.7578C2.68871 21 3.31099 21 4.55555 21Z"
						stroke="#F3F3F3"
						strokeWidth="1.6"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>

			<label
				className={cn("grid gap-0.5", {
					hidden: !isOpen || activeTab !== "birthday",
				})}
				htmlFor="birthday"
			>
				<input
					className="input text-white w-full"
					placeholder="Enter your date of birth"
					type="date"
					id="birthday"
					name="birthday"
                    value={String(value)}
					max={new Date().toISOString().split("T")[0]}
					onChange={(e) => onChange(e.target.value)}
				/>
			</label>
		</div>
	);
}
