'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useMobileTriage } from '../hooks/use-mobile-triage';
import { cn } from '@flow/ui';

interface MobileCardOverlayProps {
  id: string;
  children: React.ReactNode;
}

export function MobileCardOverlay({ id, children }: MobileCardOverlayProps) {
  const { openId, closeTriage } = useMobileTriage();
  const isOpen = openId === id;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open: boolean) => !open && closeTriage()}
    >
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-[var(--flow-bg-surface-overlay)] backdrop-blur-sm"
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{
                  duration: 0.3,
                  ease: [0.32, 0.72, 0, 1], // expressive slide-up
                }}
                data-testid="mobile-triage-overlay"
                className="fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[90vh] bg-[var(--flow-bg-surface-raised)] rounded-t-[20px] shadow-2xl overflow-hidden border-t border-[var(--flow-color-border-default)]"
              >
                <div className="flex items-center justify-between p-4 border-b border-[var(--flow-color-border-subtle)]">
                  <div className="w-12 h-1.5 rounded-full bg-[var(--flow-color-border-strong)] mx-auto absolute top-2 left-1/2 -translate-x-1/2" />
                  <Dialog.Title className="text-lg font-bold text-[var(--flow-color-text-primary)]">
                    Triage Item
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      data-testid="mobile-overlay-close"
                      className="p-2 rounded-full hover:bg-[var(--flow-bg-surface)] text-[var(--flow-color-text-secondary)]"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="flex-1 overflow-y-auto p-4">{children}</div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
