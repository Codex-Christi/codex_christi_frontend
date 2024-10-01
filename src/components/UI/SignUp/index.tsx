import { FC } from 'react';
import AuthPagesBGWrapper from '../general/auth_pages/AuthPagesBGWrapper';
import FormContainer from './FormContainer';

const SignUpMainComponent: FC = () => {
  return (
    <AuthPagesBGWrapper>
      <FormContainer />
    </AuthPagesBGWrapper>
  );
};

export default SignUpMainComponent;
