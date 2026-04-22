'use client';

import { useReducer, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../_actions/create-client';
import type { ActionResult } from '@flow/types';

interface FormState {
  name: string;
  email: string;
  phone: string;
  errors: Record<string, string>;
  isSubmitting: boolean;
}

type FormAction =
  | { field: 'name' | 'email' | 'phone'; value: string }
  | { field: 'errors'; value: Record<string, string> }
  | { field: 'isSubmitting'; value: boolean }
  | { field: 'reset-errors' };

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.field) {
    case 'name':
    case 'email':
    case 'phone':
      return { ...state, [action.field]: action.value, errors: {} };
    case 'errors':
      return { ...state, errors: action.value, isSubmitting: false };
    case 'isSubmitting':
      return { ...state, isSubmitting: action.value };
    case 'reset-errors':
      return { ...state, errors: {} };
    default:
      return state;
  }
}

const initialState: FormState = {
  name: '',
  email: '',
  phone: '',
  errors: {},
  isSubmitting: false,
};

export function CreateClientForm() {
  const router = useRouter();
  const [state, dispatch] = useReducer(formReducer, initialState);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      dispatch({ field: 'isSubmitting', value: true });

      const result: ActionResult<{ id: string; name: string }> =
        await createClient({
          name: state.name,
          email: state.email,
          phone: state.phone,
        });

      if (!result.success) {
        dispatch({ field: 'errors', value: { form: result.error.message } });
        return;
      }

      router.push(`/onboarding/log-time?clientId=${result.data.id}&clientName=${encodeURIComponent(result.data.name)}`);
    },
    [state.name, state.email, state.phone, router],
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--flow-color-foreground)]">
        Add your first client
      </h1>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="client-name" className="block text-sm font-medium text-[var(--flow-color-foreground)]">
            Client name
          </label>
          <input
            id="client-name"
            type="text"
            value={state.name}
            onChange={(e) => dispatch({ field: 'name', value: e.target.value })}
            aria-describedby={state.errors.name ? 'client-name-error' : undefined}
            aria-invalid={!!state.errors.name}
            className="mt-1 block w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border)] px-3 py-2 text-sm"
            required
          />
          {state.errors.name && (
            <p id="client-name-error" className="mt-1 text-sm text-red-600" role="alert">
              {state.errors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="client-email" className="block text-sm font-medium text-[var(--flow-color-foreground)]">
            Email (optional)
          </label>
          <input
            id="client-email"
            type="email"
            value={state.email}
            onChange={(e) => dispatch({ field: 'email', value: e.target.value })}
            aria-describedby={state.errors.email ? 'client-email-error' : undefined}
            aria-invalid={!!state.errors.email}
            className="mt-1 block w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border)] px-3 py-2 text-sm"
          />
          {state.errors.email && (
            <p id="client-email-error" className="mt-1 text-sm text-red-600" role="alert">
              {state.errors.email}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="client-phone" className="block text-sm font-medium text-[var(--flow-color-foreground)]">
            Phone (optional)
          </label>
          <input
            id="client-phone"
            type="tel"
            value={state.phone}
            onChange={(e) => dispatch({ field: 'phone', value: e.target.value })}
            className="mt-1 block w-full rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border)] px-3 py-2 text-sm"
          />
        </div>

        {state.errors.form && (
          <p className="text-sm text-red-600" role="alert">
            {state.errors.form}
          </p>
        )}

        <button
          type="submit"
          disabled={state.isSubmitting || !state.name.trim()}
          className="w-full px-6 py-3 text-sm font-medium rounded-[var(--flow-radius-md)] bg-[var(--flow-color-primary)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.isSubmitting ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
