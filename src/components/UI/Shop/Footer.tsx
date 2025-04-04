import Link from "next/link";
import Image from "next/image";
import Facebook from "@/assets/img/facebook.png";
import X from "@/assets/img/x.png";
import LinkedIn from "@/assets/img/linkedin.png";
import Instagram from "@/assets/img/instagram.png";
import Github from "@/assets/img/github.png";
import Mail from "@/assets/img/mail.png";

const sectionOne = [
	{
		name: "Help & Support",
		route: "",
	},
	{
		name: "Tract Order(s)",
		route: "",
	},
	{
		name: "Report a Product",
		route: "",
	},
	{
		name: "About Codex Christi",
		route: "",
	},
];

const sectionTwo = [
	{
		name: "Blog",
		route: "",
	},
	{
		name: "Careers",
		route: "",
	},
	{
		name: "Partnerships",
		route: "",
	},
];

const sectionThree = [
	{
		name: "Terms of Use",
		route: "",
	},
	{
		name: "Privacy & Security",
		route: "",
	},
	{
		name: "Delete Account",
		route: "",
	},
];

const sectionFour = [
	{
		name: "Refund Policy",
		route: "",
	},
	{
		name: "Payment Protection",
		route: "",
	},
];

const images = [
	{
		route: "",
		image: Instagram,
	},
	{
		route: "",
		image: Facebook,
	},
	{
		route: "",
		image: X,
	},
	{
		route: "",
		image: LinkedIn,
	},
	{
		route: "",
		image: Github,
	},
	{
		route: "",
		image: Mail,
	},
];

const Footer = () => {
	return (
		<footer className="bg-[#3D3D3D4D] grid gap-12 px-2 py-10 md:px-8 lg:px-16 text-white">
			<div className="grid gap-4 grid-cols-2 md:grid-cols-4">
				<ul className="space-y-4">
					{sectionOne.map((section) => (
						<li key={section.name}>
							<Link
								className="hover:underline hover:decoration-double underline-offset-4"
								href={section.route}
							>
								{section.name}
							</Link>
						</li>
					))}
				</ul>

				<ul className="space-y-4">
					{sectionTwo.map((section) => (
						<li key={section.name}>
							<Link
								className="hover:underline hover:decoration-double underline-offset-4"
								href={section.route}
							>
								{section.name}
							</Link>
						</li>
					))}
				</ul>

				<ul className="space-y-4">
					{sectionThree.map((section) => (
						<li key={section.name}>
							<Link
								className="hover:underline hover:decoration-double underline-offset-4"
								href={section.route}
							>
								{section.name}
							</Link>
						</li>
					))}
				</ul>

				<ul className="space-y-4">
					{sectionFour.map((section) => (
						<li key={section.name}>
							<Link
								className="hover:underline hover:decoration-double underline-offset-4"
								href={section.route}
							>
								{section.name}
							</Link>
						</li>
					))}
				</ul>
			</div>

			<div className="flex items-center justify-between flex-wrap gap-8">
				<div className="flex items-center gap-4 md:gap-8 flex-wrap">
					{images.map((media, index) => (
						<Link
							href={media.route}
							key={index}
                        >
                            <Image className="w-6 h-auto" src={media.image} alt="Connect with us" />
                        </Link>
					))}
				</div>

				<p className="text-sm">©Codex Christi</p>
			</div>
		</footer>
	);
};

export default Footer;
