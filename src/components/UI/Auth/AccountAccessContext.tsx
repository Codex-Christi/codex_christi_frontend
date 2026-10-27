'use client';

import { createContext, useContext } from 'react';

export const AccountAccessContext = createContext(true);
export const useAccountAccess = () => useContext(AccountAccessContext);
