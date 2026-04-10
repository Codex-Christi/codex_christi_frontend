// hooks/useLightboxHistory.ts
import { useHistoryStateClose } from '@/lib/hooks/useHistoryStateClose';

const LIGHTBOX_HISTORY_KEY = '__productImageLightbox';

export const useLightboxHistory = (isOpen: boolean, onClose: () => void) => {
  useHistoryStateClose({
    isOpen,
    historyKey: LIGHTBOX_HISTORY_KEY,
    onRequestClose: () => {
      onClose();
      return true;
    },
  });
};
