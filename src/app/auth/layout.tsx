import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import FormContainer from "@/components/UI/Auth/FormContainer";
import { FC, ReactNode } from 'react';

const SignupLayout: FC<{ children: ReactNode }> = ({ children }) => {
  return <DefaultPageWrapper><FormContainer>{children}</FormContainer></DefaultPageWrapper>;
};

export default SignupLayout;
