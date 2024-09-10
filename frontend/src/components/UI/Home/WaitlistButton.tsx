import { Button } from '@/components/ui/button';

const WaitlistButton = () => {
  return (
    <Button
      variant='secondary'
      className={`mt-[206px] md:mt-[216px] lg:mt-[136px] !mx-auto block font-montserrat
         bg-white text-black font-bold text-[1.15rem] py-3 !h-[unset]`}
    >
      Join waitlist
    </Button>
  );
};

export default WaitlistButton;
