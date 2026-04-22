'use client';

import { useState, useCallback } from 'react';

export function DayTwoInput() {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!value.trim()) return;

      setIsSubmitting(true);
      // Task creation deferred — inline form for habit loop bridge
      setValue('');
      setIsSubmitting(false);
    },
    [value],
  );

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <label htmlFor="day-two-task" className="block text-sm font-medium text-[var(--flow-color-foreground)]">
        What are you working on today?
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="day-two-task"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter a task..."
          className="flex-1 rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border)] px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isSubmitting || !value.trim()}
          className="px-4 py-2 text-sm font-medium rounded-[var(--flow-radius-md)] bg-[var(--flow-color-primary)] text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  );
}
