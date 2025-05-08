import Image from 'next/image';
import ProfileImage from '@/assets/img/profile-img.png';
import EditGender from './EditGender';
import EditBirthday from './EditBirthday';
import EditEmail from './EditEmail';
import EditWebsite from './EditWebsite';
import EditPhoneNumber from './EditPhoneNumber';
import EditCountry from './EditCountry';
import { cn } from '@/lib/utils';
import { SetStateAction } from 'react';
import {
  Drawer,
  //   DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerTitle,
} from '../primitives/drawer';
// import { BsCaretLeftFill } from 'react-icons/bs';

// CSS Imports

// Main Modal Component
const EditProfileModal = ({
  isActive,
  setIsActive,
}: {
  isActive: boolean;
  setIsActive: React.Dispatch<SetStateAction<boolean>>;
}) => {
  return (
    <>
      <Drawer direction='top' open={isActive} onOpenChange={setIsActive}>
        <DrawerOverlay
          className={` bg-black/[0.01] !backdrop-blur-[10px]`}
          //   onClick={() => setIsActive(false)}
        >
          <DrawerContent
            className={` !rounded-none h-full bg-black/80  !border-none
                !fixed !bottom-0 !right-0 !z-[500] w-full `}
          >
            <DrawerTitle className='!invisible'>
              <DrawerDescription>Edit Profile Modal</DrawerDescription>
            </DrawerTitle>

            {/* <DrawerClose className=' ml-6 mt-2 mb-4 text-[2.5rem]'>
              <BsCaretLeftFill />
            </DrawerClose> */}

            {/* Main Profile Modal Cotent Starts Here */}
            <div
              className={cn(
                `bg-[#0D0D0D]/[.98] backdrop-blur-lg text-white mx-auto p-8 w-[90%] space-y-2 
		            transition-transform md:w-1/2 h-[calc(100dvh-6rem)] overflow-y-auto duration-300 ease-linear 
                rounded-[10px] -translate-y-[200%] shadow-2xl lg:w-2/5 z-[500]`,
                {
                  'md:translate-y-4 translate-y-0': isActive,
                }
              )}
            >
              <div className='flex items-center justify-between'>
                <button
                  type='button'
                  aria-label='Close modal'
                  onClick={() => setIsActive(false)}
                >
                  <svg width='17' height='17' viewBox='0 0 17 17' fill='none'>
                    <path
                      fillRule='evenodd'
                      clipRule='evenodd'
                      d='M15.8492 2.13582C16.2398 1.74529 16.2398 1.11213 15.8492 0.721604C15.4587 0.33108 14.8256 0.33108 14.435 0.721604L8.07109 7.08554L1.70715 0.721604C1.31663 0.33108 0.683463 0.33108 0.292939 0.721604C-0.0975857 1.11213 -0.0975857 1.74529 0.292939 2.13582L6.65688 8.49976L0.292893 14.8637C-0.0976308 15.2543 -0.0976312 15.8874 0.292893 16.278C0.683417 16.6685 1.31658 16.6685 1.70711 16.278L8.07109 9.91397L14.4351 16.278C14.8256 16.6685 15.4588 16.6685 15.8493 16.278C16.2398 15.8874 16.2398 15.2543 15.8493 14.8637L9.4853 8.49976L15.8492 2.13582Z'
                      fill='white'
                    />
                  </svg>
                </button>

                <p className='font-bold text-lg mx-auto'>Edit Profile</p>
              </div>

              <div className='relative size-20 rounded-full mx-auto'>
                <Image
                  className='size-full rounded-full'
                  src={ProfileImage}
                  alt='User'
                />

                <div className='absolute w-full inset-0 size-full grid place-content-center'>
                  <svg width='32' height='26' viewBox='0 0 32 26' fill='none'>
                    <path
                      d='M29 26H3C1.346 26 0 24.654 0 23V7C0 5.346 1.346 4 3 4H7.381L9.102 0.554C9.27 0.214 9.617 0 9.996 0H22.006C22.385 0 22.731 0.214 22.901 0.554L24.619 4H29C30.654 4 32 5.346 32 7V23C32 24.654 30.654 26 29 26ZM30 7C30 6.449 29.551 6 29 6H24C23.95 6 23.907 5.979 23.859 5.972C23.788 5.961 23.717 5.955 23.649 5.929C23.588 5.906 23.537 5.869 23.482 5.834C23.428 5.801 23.373 5.773 23.326 5.729C23.273 5.68 23.235 5.62 23.194 5.56C23.166 5.52 23.127 5.491 23.105 5.446L21.387 2H10.615L8.895 5.446C8.848 5.541 8.785 5.623 8.715 5.695C8.701 5.71 8.684 5.719 8.669 5.733C8.597 5.798 8.518 5.851 8.432 5.892C8.403 5.907 8.375 5.919 8.344 5.931C8.234 5.971 8.12 5.999 8.002 6H8H3C2.449 6 2 6.449 2 7V23C2 23.551 2.449 24 3 24H29C29.551 24 30 23.551 30 23V7ZM16 21C12.14 21 9 17.86 9 14C9 10.14 12.14 7 16 7C19.86 7 23 10.14 23 14C23 17.86 19.86 21 16 21ZM16 9C13.243 9 11 11.243 11 14C11 16.757 13.243 19 16 19C18.757 19 21 16.757 21 14C21 11.243 18.757 9 16 9Z'
                      fill='white'
                    />
                  </svg>
                </div>
              </div>

              <div className='grid gap-6'>
                <label className='grid gap-0.5' htmlFor='name'>
                  <span className='text-white/70'>Fullname</span>

                  <input
                    className='input'
                    type='text'
                    placeholder='Fullname'
                    id='name'
                    name='name'
                  />

                  <span className='text-sm'>
                    *name can be changed once in 6 months
                  </span>
                </label>

                <label className='grid gap-0.5' htmlFor='username'>
                  <span className='text-white/70'>Username</span>

                  <input
                    className='input'
                    type='text'
                    placeholder='Username'
                    id='username'
                    name='username'
                  />
                </label>

                <label className='grid gap-0.5' htmlFor='bio'>
                  <span className='text-white/70'>Bio</span>

                  <input
                    className='input'
                    type='text'
                    placeholder='Bio'
                    id='bio'
                    name='bio'
                  />
                </label>

                <EditCountry />

                <div className='grid gap-0.5'>
                  <p className='text-white/70'>Select Gender</p>

                  <EditGender />
                </div>

                <EditEmail />

                <EditPhoneNumber />

                <EditBirthday />

                <EditWebsite />

                <button
                  className='bg-[#0085FF] text-white font-semibold rounded py-3 px-5 mx-auto block'
                  type='button'
                >
                  Save changes
                </button>
              </div>
            </div>

            {/* Ends Here*/}
          </DrawerContent>
        </DrawerOverlay>
      </Drawer>
    </>
  );
};

export default EditProfileModal;
