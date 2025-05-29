import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const EditPhoneNumber = ({
	onChange,
	value,
}: {
	onChange: (e: string | undefined) => void;
	value: string | null | number;
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [activeTab, setActiveTab] = useState("");

	const [phoneValue, setPhoneValue] = useState<string | undefined>(
		value ? String(value) : undefined,
	);

	const lastCountryCodeRef = useRef<string | undefined>();

	useEffect(() => {
		if (phoneValue) {
			const match = phoneValue.match(/^(\+\d{1,4})/);

			if (match) {
				lastCountryCodeRef.current = match[1];
			}
		}
	}, [phoneValue]);

	const handlePhoneChange = (newValue: string | undefined) => {
		if (!newValue && lastCountryCodeRef.current) {
			setPhoneValue(lastCountryCodeRef.current);

			onChange(lastCountryCodeRef.current);
		} else {
			setPhoneValue(newValue);

			onChange(newValue);
		}
	};

	return (
		<div className="grid gap-2">
			<button
				className="flex items-center gap-4 justify-between py-1"
				type="button"
				onClick={() => {
					setIsOpen(!isOpen);
					setActiveTab("mobile_phone");
				}}
			>
				<span>
					{value ? "Update Phone Number" : "Add Phone Number"}
				</span>

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
					hidden: !isOpen || activeTab !== "mobile_phone",
				})}
				htmlFor="email"
			>
				<div className="grid gap-4 bg-inherit">
					<PhoneInput
						placeholder="Enter phone number"
						international
						defaultCountry={undefined}
						value={phoneValue}
						onChange={handlePhoneChange}
						className="input border-transparent rounded-none bg-[#0D0D0D]"
					/>
				</div>
			</label>
		</div>
	);
};

export default EditPhoneNumber;
