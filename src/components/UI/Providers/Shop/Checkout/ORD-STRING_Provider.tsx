'use client';
import { decrypt, encrypt } from '@/stores/shop_stores/cartStore';
import { createContext, useContext, useState, type ReactNode } from 'react';

// Define the shape of your context state
interface StringContextType {
  shared_ORD_String: string;
  setShared_ORD_String: (newString: string) => void;
}

// Create the context with a default value
const SharedORDStringContext = createContext<StringContextType | undefined>(undefined);

// Create the provider component
export function StringProvider({ children }: { children: ReactNode }) {
  const [sharedString, setSharedString] = useState('');

  const shared_ORD_String = decrypt(sharedString); // Example shared string
  const setShared_ORD_String = (newString: string) => {
    setSharedString(encrypt(newString));
  };

  return (
    <SharedORDStringContext.Provider value={{ shared_ORD_String, setShared_ORD_String }}>
      {children}
    </SharedORDStringContext.Provider>
  );
}

// Create a custom hook to use the context
export function useSharedORDString() {
  const context = useContext(SharedORDStringContext);
  if (context === undefined) {
    throw new Error('useSharedORDString must be used within a StringProvider');
  }
  return context;
}
