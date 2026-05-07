'use client';

import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn } from '@flow/ui';
import { useRef, useState } from 'react';

interface SwipeableCardProps {
  children: React.ReactNode;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
}

export function SwipeableCard({ children, onApprove, onReject, disabled }: SwipeableCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-100, 100], [-5, 5]);
  const opacity = useTransform(x, [-150, -100, 0, 100, 150], [0, 1, 1, 1, 0]);
  const approveOpacity = useTransform(x, [0, 80], [0, 1]);
  const rejectOpacity = useTransform(x, [-80, 0], [1, 0]);

  const [isSwiping, setIsSwiping] = useState<'approve' | 'reject' | null>(null);
  const isFiring = useRef(false);

  const SWIPE_THRESHOLD = 80;

  const triggerHaptic = (intensity: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(intensity);
    }
  };

  const handleDragEnd = async (_: any, info: any) => {
    if (isFiring.current) return;
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset > SWIPE_THRESHOLD || velocity > 500) {
      isFiring.current = true;
      triggerHaptic(10);
      setIsSwiping(null);
      await animate(x, 500, { duration: 0.2 });
      onApprove();
      isFiring.current = false;
    } else if (offset < -SWIPE_THRESHOLD || velocity < -500) {
      isFiring.current = true;
      triggerHaptic(10);
      setIsSwiping(null);
      await animate(x, -500, { duration: 0.2 });
      onReject();
      isFiring.current = false;
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 20 });
      setIsSwiping(null);
    }
  };

  const handleDrag = (_: any, info: any) => {
    const offset = info.offset.x;
    if (offset > 40 && isSwiping !== 'approve') {
      setIsSwiping('approve');
      triggerHaptic(10);
    } else if (offset < -40 && isSwiping !== 'reject') {
      setIsSwiping('reject');
      triggerHaptic(10);
    } else if (Math.abs(offset) < 40 && isSwiping !== null) {
      setIsSwiping(null);
    }
  };

  return (
    <div className="relative w-full touch-none">
      <motion.div
        style={{ x, rotate, opacity }}
        drag={disabled ? false : 'x'}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className={cn(
          'relative z-10 w-full p-4 rounded-xl border border-[var(--flow-color-border-default)] bg-[var(--flow-bg-surface-raised)] shadow-sm cursor-grab active:cursor-grabbing',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        {children}
      </motion.div>

      {/* Swipe Actions Background */}
      <div className="absolute inset-0 flex items-center justify-between px-8 rounded-xl overflow-hidden pointer-events-none">
        <motion.div
          style={{ opacity: rejectOpacity }}
          className="flex items-center gap-2 text-[var(--flow-status-error)] font-bold uppercase tracking-tighter"
        >
          <X className="w-6 h-6" />
          <span>Reject</span>
        </motion.div>

        <motion.div
          style={{ opacity: approveOpacity }}
          className="flex items-center gap-2 text-[var(--flow-status-success)] font-bold uppercase tracking-tighter"
        >
          <span>Approve</span>
          <Check className="w-6 h-6" />
        </motion.div>
      </div>

      {/* Feedback Overlay */}
      <AnimatePresence>
        {isSwiping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.05 }}
            exit={{ opacity: 0 }}
            className={cn(
              'absolute inset-0 rounded-xl z-0',
              isSwiping === 'approve' ? 'bg-[var(--flow-status-success)]' : 'bg-[var(--flow-status-error)]',
            )}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
