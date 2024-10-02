import { FC } from 'react';
import Logo from '../general/Logo';
import SignUpForm from './SignUpForm';

const FormContainer: FC = () => {
  return (
    <>
      <section
        className='pt-8 mx-auto flex flex-col gap-6
        w-[83%] max-w-[385px]
        sm:w-[73%] sm:max-w-[430px]
        md:w-[53%] md:max-w-[440px]
        lg:w-[48%] lg:max-w-[455px]'
      >
        <Logo
          with_text
          className='scale-[1.1] lg:scale-[.95] !mx-auto !w-max'
        />

        <div
          className={`flex w-full justify-between text-[100%] font-nico text-shadow-sm shadow-white
            `}
        >
          {['create', 'connect', 'transform'].map((el, index) => {
            return <h3 key={`${el}-${index}`}>{el.toLocaleUpperCase()}</h3>;
          })}
        </div>
      </section>

      {/* FORM ELEMENT */}
      <SignUpForm />
    </>
  );
};

export default FormContainer;
