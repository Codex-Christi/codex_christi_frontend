import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/UI/primitives/select";

export default function EditGender() {
	return (
		<Select>
			<SelectTrigger className="w-full bg-[#0D0D0DFA] text-white data-[placeholder]:text-white py-4">
				<SelectValue
					className="text-white"
					placeholder="Select Gender"
				/>
			</SelectTrigger>

			<SelectContent className="bg-black text-white !z-[500]">
				<SelectGroup>
					<SelectItem value="male">Male</SelectItem>
					<SelectItem value="female">Female</SelectItem>
					<SelectItem value="none">Prefer not to say</SelectItem>
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}
