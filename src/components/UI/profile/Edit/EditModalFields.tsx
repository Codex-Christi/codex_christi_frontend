import EditGender from './EditGender';
import EditBirthday from './EditBirthday';
import EditEmail from './EditEmail';
import EditWebsite from './EditWebsite';
import EditPhoneNumber from './EditPhoneNumber';
import EditCountry from './EditCountry';
import EditProfilePicture from './EditProfilePicture';
import EditProfileSubmitButton from './EditProfileSubmitButton';
import en from 'react-phone-number-input/locale/en';
import { FC, useEffect, useCallback, useMemo } from 'react';
import { getCurrencyAbbreviation } from 'currency-map-country';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { useEditUserMainProfileStore } from '@/stores/editUserProfileStore';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';

interface EditModalFieldsProps {
  isOpen: boolean;
  onRequestClose: () => void;
}

const EditModalFields: FC<EditModalFieldsProps> = ({ isOpen, onRequestClose }) => {
  const editProfileData = useEditUserMainProfileStore((state) => state.userEditData);
  const updateEditField = useEditUserMainProfileStore((state) => state.updateUserEditField);
  const initializeFromMainProfile = useEditUserMainProfileStore(
    (state) => state.initializeFromMainProfile,
  );
  const clearEditData = useEditUserMainProfileStore((state) => state.clearEditData);
  const mainProfileData = useUserMainProfileStore((state) => state.userMainProfile);

  useEffect(() => {
    if (!isOpen || editProfileData) return;
    initializeFromMainProfile();
  }, [editProfileData, initializeFromMainProfile, isOpen]);

  useEffect(() => {
    if (isOpen) return;
    clearEditData();
  }, [clearEditData, isOpen]);

  const resolvedValues = useMemo<Partial<UserProfileDataInterface>>(
    () => ({
      ...(mainProfileData ?? {}),
      ...(editProfileData ?? {}),
    }),
    [editProfileData, mainProfileData],
  );

  const getEditFieldValue = useCallback(
    (name: keyof UserProfileDataInterface) => {
      const val = resolvedValues[name];
      return val instanceof File ? val.name : (val ?? '');
    },
    [resolvedValues],
  );

  const setFormValues = useCallback(
    (fieldName: keyof UserProfileDataInterface, value: string | Blob | undefined | null) => {
      updateEditField(fieldName, value as UserProfileDataInterface[keyof UserProfileDataInterface]);
    },
    [updateEditField],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormValues(name as keyof UserProfileDataInterface, value);
    },
    [setFormValues],
  );

  const countryCode = resolvedValues.country;
  const currentCurrency = resolvedValues.currency;

  useEffect(() => {
    if (!countryCode || typeof countryCode !== 'string') return;
    const countryName = en[countryCode as keyof typeof en];
    if (!countryName) return;
    const currency = getCurrencyAbbreviation(countryName);
    if (!currency || currency === currentCurrency) return;
    setFormValues('currency', currency);
  }, [countryCode, currentCurrency, setFormValues]);

  const handleClose = useCallback(() => {
    clearEditData();
    onRequestClose();
  }, [clearEditData, onRequestClose]);

  return (
    <section className='flex h-full w-full flex-col bg-[#050505]/80 text-white'>
      <div className='sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#050505]/95 px-6 py-4 backdrop-blur-xl'>
        <button type='button' aria-label='Close modal' onClick={handleClose} className='p-1'>
          <svg width='17' height='17' viewBox='0 0 17 17' fill='none'>
            <path
              fillRule='evenodd'
              clipRule='evenodd'
              d='M15.8492 2.13582C16.2398 1.74529 16.2398 1.11213 15.8492 0.721604C15.4587 0.33108 14.8256 0.33108 14.435 0.721604L8.07109 7.08554L1.70715 0.721604C1.31663 0.33108 0.683463 0.33108 0.292939 0.721604C-0.0975857 1.11213 -0.0975857 1.74529 0.292939 2.13582L6.65688 8.49976L0.292893 14.8637C-0.0976308 15.2543 -0.0976312 15.8874 0.292893 16.278C0.683417 16.6685 1.31658 16.6685 1.70711 16.278L8.07109 9.91397L14.4351 16.278C14.8256 16.6685 15.4588 16.6685 15.8493 16.278C16.2398 15.8874 16.2398 15.2543 15.8493 14.8637L9.4853 8.49976L15.8492 2.13582Z'
              fill='white'
            />
          </svg>
        </button>

        <p className='mx-auto font-bold text-lg'>Edit Profile</p>
      </div>

      <div className='px-6 pb-6 pt-4 text-center text-sm text-yellow-400'>
        Please note that excluding the profile picture, each field can be changed once in six months.
      </div>

      <div className='flex-1 overflow-y-auto px-6 pb-10'>
        <div className='space-y-8'>
          <EditProfilePicture />

          <div className='grid gap-6'>
            <section className='grid gap-3 md:grid-cols-2'>
              {[
                { name: 'first_name', text: 'First Name' },
                { name: 'last_name', text: 'Last Name' },
              ].map(({ name, text }) => (
                <label key={name} className='grid w-full gap-0.5' htmlFor={name}>
                  <span className='text-white/70'>{text}</span>
                  <input
                    className='input w-full'
                    type='text'
                    placeholder={text}
                    id={name}
                    name={name}
                    value={getEditFieldValue(name as keyof UserProfileDataInterface)}
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
                value={getEditFieldValue('username')}
                onChange={handleInputChange}
              />
            </label>

            <label className='grid gap-0.5' htmlFor='bio'>
              <span className='text-white/70'>Bio</span>
              <input
                className='input'
                type='text'
                id='bio'
                name='bio'
                placeholder='Bio'
                value={getEditFieldValue('bio')}
                onChange={handleInputChange}
              />
            </label>

            <EditCountry
              value={resolvedValues.country ?? ''}
              onChange={(val) => setFormValues('country', val)}
              className='w-full'
            />

            <div className='grid gap-0.5'>
              <p className='text-white/70'>Select Gender</p>
              <EditGender
                value={resolvedValues.gender ?? ''}
                onChange={(val) => setFormValues('gender', val)}
              />
            </div>

            <EditEmail value={resolvedValues.email ?? ''} onChange={(val) => setFormValues('email', val)} />

            <EditPhoneNumber
              value={resolvedValues.mobile_phone ?? ''}
              onChange={(val) => setFormValues('mobile_phone', val)}
            />

            <EditBirthday
              value={resolvedValues.date_of_birth ?? ''}
              onChange={(val) => setFormValues('date_of_birth', val)}
            />

            <EditWebsite
              value={resolvedValues.website ?? ''}
              onChange={(val) => setFormValues('website', val)}
            />

            <EditProfileSubmitButton onClose={handleClose} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default EditModalFields;
