'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useQueryState } from 'nuqs';

interface MobileBottomSheetProps {
  name: string;
  title: string;
  children: React.ReactNode;
}

export function MobileBottomSheet({ name, title, children }: MobileBottomSheetProps) {
  const [sheet, setSheet] = useQueryState('sheet', { scroll: false, shallow: true });

  const isOpen = sheet === name;
  const closeSheet = () => setSheet(null);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && closeSheet()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px]"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-[var(--flow-bg-surface-raised)] rounded-t-[32px] shadow-2xl overflow-hidden border-t border-[var(--flow-color-border-default)]"
              >
                <div className="w-12 h-1.5 rounded-full bg-[var(--flow-color-border-strong)] mx-auto mt-3 mb-2" />

                <div className="flex items-center justify-between px-6 py-4">
                  <Dialog.Title className="text-xl font-bold text-[var(--flow-color-text-primary)]">
                    {title}
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button className="p-2 rounded-full hover:bg-[var(--flow-bg-surface)] text-[var(--flow-color-text-secondary)]">
                      <X className="w-5 h-5" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-12">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
