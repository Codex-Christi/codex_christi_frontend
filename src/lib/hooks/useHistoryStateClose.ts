'use client';

import { useEffect, useRef } from 'react';

const getHistoryState = () =>
  window.history.state && typeof window.history.state === 'object' ? window.history.state : {};

type UseHistoryStateCloseParams = {
  isOpen: boolean;
  historyKey: string;
  onRequestClose: () => boolean;
};

export const useHistoryStateClose = ({
  isOpen,
  historyKey,
  onRequestClose,
}: UseHistoryStateCloseParams) => {
  const hasHistoryEntry = useRef(false);
  const isOpenRef = useRef(isOpen);
  const onRequestCloseRef = useRef(onRequestClose);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    onRequestCloseRef.current = onRequestClose;
  }, [onRequestClose]);

  useEffect(() => {
    if (!isOpen) {
      if (hasHistoryEntry.current) {
        const nextState = { ...getHistoryState() };
        delete nextState[historyKey];
        window.history.replaceState(nextState, '', window.location.href);
        hasHistoryEntry.current = false;
      }
      return;
    }

    const handlePopState = () => {
      if (!isOpenRef.current || !hasHistoryEntry.current) return;

      hasHistoryEntry.current = false;
      const didClose = onRequestCloseRef.current();

      if (!didClose) {
        window.history.pushState({ ...getHistoryState(), [historyKey]: true }, '', window.location.href);
        hasHistoryEntry.current = true;
      }
    };

    window.history.pushState({ ...getHistoryState(), [historyKey]: true }, '', window.location.href);
    hasHistoryEntry.current = true;
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [historyKey, isOpen]);
};
