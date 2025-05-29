import { FC } from 'react';
import { SearchButtonOnly } from './NavSearch';
import { CartIcon } from './NavIcons';
import { Heart } from 'lucide-react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import UserAvatar from './ShopUserAvatar';

const NavTopRightLinks: FC = () => {
	// Hooks

	// JSX
	return (
		<section
			className="flex items-center justify-between gap-6 sm:gap-8 md:gap-10 lg:gap-12"
		>
			<SearchButtonOnly
				name="Search Button"
				className="scale-125 relative block lg:!hidden"
				isDesktopOnly={false}
			/>

			<>
				{["cart", "favorites", "profile"].map((str, index) => {
					let href = "";

					if (str === "profile") {
						href = "/" + str;
					} else {
						href = "/shop/" + str;
					}

					return (
						<CustomShopLink
							href={href}
							key={str + index}
						>
							{str === "cart" && <CartIcon />}
							{str === "favorites" && <Heart />}
							{str === "profile" && (
								<UserAvatar
									src="https://avatar.iran.liara.run/public"
									alt={"User avatar"}
									width={25}
									height={25}
								/>
							)}
						</CustomShopLink>
					);
				})}
			</>
		</section>
	);
};

export default NavTopRightLinks;
