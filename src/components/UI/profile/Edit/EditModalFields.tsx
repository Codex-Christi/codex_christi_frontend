import EditGender from './EditGender';
import EditBirthday from './EditBirthday';
import EditEmail from './EditEmail';
import EditWebsite from './EditWebsite';
import EditPhoneNumber from './EditPhoneNumber';
import EditCountry from './EditCountry';
import EditProfilePicture from './EditProfilePicture';
import EditProfileSubmitButton from './EditProfileSubmitButton';
import en from 'react-phone-number-input/locale/en';
import { FC, SetStateAction, useEffect, useCallback } from 'react';
import { getCurrencyAbbreviation } from 'currency-map-country';
import { cn } from '@/lib/utils';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { useEditUserMainProfileStore } from '@/stores/editUserProfileStore';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';

interface EditModalFieldsProps {
  isActive: boolean;
  setIsActive: React.Dispatch<SetStateAction<boolean>>;
}

const EditModalFields: FC<EditModalFieldsProps> = ({
  isActive,
  setIsActive,
}) => {
  // Stores
  const editProfileData = useEditUserMainProfileStore(
    (state) => state.userEditData
  );

  const setUserEditData = useEditUserMainProfileStore(
    (state) => state.setUserEditData
  );

  const mainProfileData = useUserMainProfileStore(
    (state) => state.userMainProfile
  );

  const getEditFieldValues = useCallback(
    (name: keyof UserProfileDataInterface) => {
      const val = editProfileData?.[name] ?? mainProfileData?.[name] ?? '';

      return val instanceof File ? val.name : val;
    },
    [editProfileData, mainProfileData]
  );

  const setFormValues = (
    fieldName: keyof UserProfileDataInterface,
    value: string | undefined
  ) => {
    setUserEditData({
      ...editProfileData,
      [fieldName]: value,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.name as keyof UserProfileDataInterface;

    setFormValues(name, e.target.value);
  };

  useEffect(() => {
    const countryCode = getEditFieldValues('country');

    if (countryCode && typeof countryCode === 'string') {
      const countryName = en[countryCode as keyof typeof en];

      if (countryName) {
        const currency = getCurrencyAbbreviation(countryName);

        if (currency) {
          setFormValues('currency', currency);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getEditFieldValues('country')]);

  // Main JSX
  return (
    <div
      className={cn(
        `bg-[#0D0D0D]/[.98] backdrop-blur-lg text-white mx-auto p-8 w-[90%] space-y-2 transition-transform md:w-[60%] h-[calc(100dvh-3rem)] md:h-[calc(100dvh-4rem)] overflow-y-auto duration-300 ease-linear rounded-[10px] -translate-y-[200%] shadow-2xl lg:w-2/5 z-[500] max-w-full overflow-x-hidden`,
        { 'md:translate-y-4 translate-y-0': isActive }
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

      <p className='text-yellow-500 text-center'>
        Please note that excluding the profile picture, each field can be
        changed once in 6 months.
      </p>

      <EditProfilePicture />

      <div className='grid gap-6'>
        <section className='grid md:grid-cols-2 gap-3'>
          {[
            { name: 'first_name', text: 'First Name' },
            { name: 'last_name', text: 'Last Name' },
          ].map(({ name, text }) => (
            <label key={name} className='grid gap-0.5 w-full' htmlFor={name}>
              <span className='text-white/70'>{text}</span>
              <input
                className='input w-full'
                type='text'
                placeholder={text}
                id={name}
                name={name}
                value={getEditFieldValues(
                  name as keyof UserProfileDataInterface
                )}
                onChange={handleInputChange}
              />
            </label>
          ))}
        </section>

        <label className='grid gap-0.5' htmlFor='username'>
          <span className='text-white/70'>Username</span>

          <input
            className='input'
            type='text'
            id='username'
            name='username'
            placeholder='Username'
            value={getEditFieldValues('username')}
            onChange={handleInputChange}
          />
        </label>

        {/* Bio */}
        <label className='grid gap-0.5' htmlFor='bio'>
          <span className='text-white/70'>Bio</span>
          <input
            className='input'
            type='text'
            id='bio'
            name='bio'
            placeholder='Bio'
            value={getEditFieldValues('bio')}
            onChange={handleInputChange}
          />
        </label>

        <EditCountry
          value={getEditFieldValues('country')}
          onChange={(val) => setFormValues('country', val)}
        />

        <div className='grid gap-0.5'>
          <p className='text-white/70'>Select Gender</p>

          <EditGender
            value={getEditFieldValues('gender')}
            onChange={(val) => setFormValues('gender', val)}
          />
        </div>

        <EditEmail
          value={getEditFieldValues('email')}
          onChange={(val) => setFormValues('email', val)}
        />

        <EditPhoneNumber
          value={getEditFieldValues('mobile_phone')}
          onChange={(val) => setFormValues('mobile_phone', val)}
        />

        <EditBirthday
          value={getEditFieldValues('date_of_birth')}
          onChange={(val) => setFormValues('date_of_birth', val)}
        />

        <EditWebsite
          value={getEditFieldValues('website')}
          onChange={(val) => setFormValues('website', val)}
        />

        <EditProfileSubmitButton />
      </div>
    </div>
  );
};

export default EditModalFields;
