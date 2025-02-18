import { Button, ButtonProps } from '@/components/UI/primitives/button';
import { FC, MouseEventHandler } from 'react';
import { RxCaretRight } from 'react-icons/rx';

interface ContinueButtonInterface extends ButtonProps {
  onClick: MouseEventHandler<HTMLButtonElement>;
}

export const ContinueButton: FC<ContinueButtonInterface> = (props) => {
  return (
    <Button
      type='button'
      variant='secondary'
      className={`mt-5 mx-auto font-bold text-[1.05rem] rounded-[2rem] flex 
              px-5 !py-[1.25rem] h-[2.4rem]`}
      {...props}
    >
      Continue <RxCaretRight className='!text-[1.25rem] !stroke-1' />
    </Button>
  );
};

// Submit Buttons
interface SubmitButtonInterface extends ButtonProps {
  textValue: string;
}
export const SubmitButton: FC<SubmitButtonInterface> = (props) => {
  return (
    <Button
      name='Submit form'
      type='submit'
      variant='secondary'
      className={`mt-5 mx-auto font-bold text-[1.05rem] rounded-[2rem] flex 
              px-5 !py-[1.25rem] h-[2.4rem] ${props.className}`}
    >
      {props.textValue} <RxCaretRight className='!text-[1.25rem] !stroke-1' />
    </Button>
  );
};
