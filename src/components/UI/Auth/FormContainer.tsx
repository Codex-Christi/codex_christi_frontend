import AuthPagesBGWrapper from "@/components/UI/auth_pages/AuthPagesBGWrapper";
import Logo from "../general/Logo";
import { FC } from "react";
import CometsContainer from "../general/CometsContainer";

interface IFormContainer {
	children: React.ReactNode;
}

const FormContainer: FC<IFormContainer> = ({ children }) => {
	return (
		<AuthPagesBGWrapper>
			<CometsContainer />

			<section
				className="mx-auto mt-8 flex flex-col gap-6 !select-none
                w-[83%] max-w-[385px]
                sm:w-[73%] sm:max-w-[430px]
                md:w-[53%] md:max-w-[440px]
                lg:w-[48%] lg:max-w-[455px]"
			>
				<Logo
					with_text
					className="scale-[1.1] lg:scale-[.95] !mx-auto w-4/5"
				/>

				<div
					className={`flex w-full justify-between text-[100%] gap-4 flex-wrap font-nico text-shadow-sm shadow-white`}
				>
					{["create", "connect", "transform"].map((el, index) => {
						return (
							<h3 key={`${el}-${index}`}>
								{el.toLocaleUpperCase()}
							</h3>
						);
					})}
				</div>
			</section>

			{children}
		</AuthPagesBGWrapper>
	);
};

export default FormContainer;
