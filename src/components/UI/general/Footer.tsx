/* eslint-disable @next/next/no-img-element */

const Footer = () => {
    return (
        <footer className="bg-[#3d3d3d] text-white flex justify-between flex-wrap gap-4 p-8">
            <div className="flex items-center gap-7 flex-wrap">
                <a className="font-bold text-2xl border-r border-white pr-3.5" href="/contact-us">
                    Contact Us
                </a>

                <div className="flex items-center gap-8 flex-wrap">
                    <a href="#">
                        <img src="/media/img/general/instagram-icon.svg" height={24} width={24} alt="Instagram" />
                    </a>

                    <a href="#">
                        <img src="/media/img/general/facebook-icon.svg" height={24} width={24} alt="Facebook" />
                    </a>

                    <a href="#">
                        <img src="/media/img/general/x-icon.svg" height={24} width={24} alt="X" />
                    </a>

                    <a href="#">
                        <img src="/media/img/general/linkedin-icon.svg" height={24} width={24} alt="LinkedIn" />
                    </a>

                    <a href="#">
                        <img src="/media/img/general/github-icon.svg" height={24} width={24} alt="Github" />
                    </a>

                    <a href="#">
                        <img src="/media/img/general/gmail-icon.svg" height={24} width={24} alt="Gmail" />
                    </a>
                </div>
            </div>

            <p>
                &copy;Codex Christi
            </p>
        </footer>
    );
};

export default Footer;
