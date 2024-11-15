import Link from "next/link";
import Image from "next/image";

const Footer = () => {
    return (
        <footer className="bg-[#3d3d3d] text-white flex justify-between flex-wrap gap-4 p-8">
            <div className="flex items-center gap-7 flex-wrap">
                <Link className="font-bold text-lg lg:text-2xl lg:border-r lg:border-white pr-3.5" href="/contact-us">
                    Contact Us
                </Link>

                <div className="flex items-center gap-8 flex-wrap">
                    <Link href="">
                        <Image src="/media/img/general/instagram-icon.svg" height={24} width={24} alt="Instagram" />
                    </Link>

                    <Link href="">
                        <Image src="/media/img/general/facebook-icon.svg" height={24} width={24} alt="Facebook" />
                    </Link>

                    <Link href="">
                        <Image src="/media/img/general/x-icon.svg" height={24} width={24} alt="X" />
                    </Link>

                    <Link href="">
                        <Image src="/media/img/general/linkedin-icon.svg" height={24} width={24} alt="LinkedIn" />
                    </Link>

                    <Link href="">
                        <Image src="/media/img/general/github-icon.svg" height={24} width={24} alt="Github" />
                    </Link>

                    <Link href="">
                        <Image src="/media/img/general/gmail-icon.svg" height={24} width={24} alt="Gmail" />
                    </Link>
                </div>
            </div>

            <p className="text-sm">
                &copy;Codex Christi
            </p>
        </footer>
    );
};

export default Footer;
