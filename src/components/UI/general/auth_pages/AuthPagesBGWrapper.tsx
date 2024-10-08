import { FC, ReactNode } from 'react';
import styles from '@/styles/auth_pages_styles/AuthPagesBg.module.css';

const AuthPagesBGWrapper: FC<{ children?: ReactNode }> = ({ children }) => {
  return <main className={styles.auth_page_bg}>{children}</main>;
};

export default AuthPagesBGWrapper;
