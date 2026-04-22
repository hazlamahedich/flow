'use client';

import { Suspense, useReducer, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { logTimeEntry } from '../../_actions/log-time-entry';
import type { ActionResult } from '@flow/types';

interface FormState {
  clientId: string;
  clientName: string;
  date: string;
  durationMinutes: string;
  description: string;
  errors: Record<string, string>;
  isSubmitting: boolean;
}

type FormAction =
  | { field: 'clientId' | 'clientName' | 'date' | 'durationMinutes' | 'description'; value: string }
  | { field: 'errors'; value: Record<string, string> }
  | { field: 'isSubmitting'; value: boolean };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.field) {
    case 'clientId':
    case 'clientName':
    case 'date':
    case 'durationMinutes':
    case 'description':
      return { ...state, [action.field]: action.value, errors: {} };
    case 'errors':
      return { ...state, errors: action.value, isSubmitting: false };
    case 'isSubmitting':
      return { ...state, isSubmitting: action.value };
    default:
      return state;
  }
}

function LogTimeFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = (searchParams.get('clientId') ?? '').trim();
  const clientName = searchParams.get('clientName') ?? '';

  const today = new Date().toISOString().split('T')[0];

  const [state, dispatch] = useReducer(formReducer, {
    clientId,
    clientName,
    date: today,
    durationMinutes: '',
    description: '',
    errors: {},
    isSubmitting: false,
  });

  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!clientId && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push('/onboarding/create-client');
    }
  }, [clientId, router]);

  if (!clientId) {
    return (
      <div className="text-center text-sm text-[var(--flow-color-muted-foreground)]">
        Redirecting...
      </div>
    );
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      dispatch({ field: 'isSubmitting', value: true });

      const duration = Number(state.durationMinutes);
      const result: ActionResult<{ id: string }> = await logTimeEntry({
        client_id: state.clientId,
        date: state.date,
        duration_minutes: duration,
        description: state.description,
      });

      if (!result.success) {
        dispatch({ field: 'errors', value: { form: result.error.message } });
        return;
      }

      router.push('/onboarding/completion');
    },
    [state.clientId, state.date, state.durationMinutes, state.description, router],
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--flow-color-foreground)]">
        Log your first session
      </h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="time-client" className="block text-sm font-medium text-[var(--flow-color-foreground)]">
            Client
          </label>
          <input
            id="time-client"
            type="text"
            value={state.clientName}
            readOnly
            className="mt-1 block w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border)] bg-[var(--flow-color-muted)] px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="time-date" className="block text-sm font-medium text-[var(--flow-color-foreground)]">
            Date
          </label>
          <input
            id="time-date"
            type="date"
            value={state.date}
            onChange={(e) => dispatch({ field: 'date', value: e.target.value })}
            aria-describedby={state.errors.date ? 'time-date-error' : undefined}
            aria-invalid={!!state.errors.date}
            className="mt-1 block w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border)] px-3 py-2 text-sm"
            required
          />
          {state.errors.date && (
            <p id="time-date-error" className="mt-1 text-sm text-red-600" role="alert">
              {state.errors.date}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="time-duration" className="block text-sm font-medium text-[var(--flow-color-foreground)]">
            Duration (minutes)
          </label>
          <input
            id="time-duration"
            type="number"
            min={1}
            max={1440}
            value={state.durationMinutes}
            onChange={(e) => dispatch({ field: 'durationMinutes', value: e.target.value })}
            aria-describedby={state.errors.duration_minutes ? 'time-duration-error' : undefined}
            aria-invalid={!!state.errors.duration_minutes}
            className="mt-1 block w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border)] px-3 py-2 text-sm"
            required
            placeholder="60"
          />
          {state.errors.duration_minutes && (
            <p id="time-duration-error" className="mt-1 text-sm text-red-600" role="alert">
              {state.errors.duration_minutes}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="time-description" className="block text-sm font-medium text-[var(--flow-color-foreground)]">
            Description (optional)
          </label>
          <textarea
            id="time-description"
            value={state.description}
            onChange={(e) => dispatch({ field: 'description', value: e.target.value })}
            className="mt-1 block w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border)] px-3 py-2 text-sm"
            rows={2}
          />
        </div>

        {state.errors.form && (
          <p className="text-sm text-red-600" role="alert">
            {state.errors.form}
          </p>
        )}

        <button
          type="submit"
          disabled={state.isSubmitting || !state.durationMinutes}
          className="w-full px-6 py-3 text-sm font-medium rounded-[var(--flow-radius-md)] bg-[var(--flow-color-primary)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.isSubmitting ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}

export function LogTimeFormWithSuspense() {
  return (
    <Suspense fallback={<div className="text-center text-sm text-[var(--flow-color-muted-foreground)]">Loading...</div>}>
      <LogTimeFormInner />
    </Suspense>
  );
}

export { LogTimeFormInner as LogTimeForm };
