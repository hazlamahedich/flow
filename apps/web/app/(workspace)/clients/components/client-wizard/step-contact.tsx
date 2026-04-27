'use client';

import { useRef, useCallback, useState } from 'react';
import type { ContactData } from '../../actions/wizard-types';
import { checkDuplicateEmailAction } from '../../actions/check-duplicate-email';

interface StepContactProps {
  data: ContactData;
  onChange: (data: ContactData) => void;
  onNext: () => void;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}

interface DuplicateWarning {
  clientId: string;
  clientName: string;
}

export function StepContact({ data, onChange, onNext, headingRef }: StepContactProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, name: e.target.value });
  };
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, email: e.target.value });
    setDuplicateWarning(null);
  };
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, phone: e.target.value });
  };
  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...data, company_name: e.target.value });
  };

  const isNameValid = data.name.trim().length >= 1 && data.name.trim().length <= 200;

  const handleNext = useCallback(async () => {
    if (!isNameValid) return;

    const email = data.email?.trim();
    if (email && email.length > 0) {
      setCheckingDuplicate(true);
      try {
        const result = await checkDuplicateEmailAction({ email });
        if (result.success && result.data.exists && result.data.clientId && result.data.clientName) {
          setDuplicateWarning({ clientId: result.data.clientId, clientName: result.data.clientName });
          setCheckingDuplicate(false);
          return;
        }
      } catch {
        // proceed on error
      }
      setCheckingDuplicate(false);
    }

    setDuplicateWarning(null);
    onNext();
  }, [isNameValid, data.email, onNext]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isNameValid) {
      e.preventDefault();
      handleNext();
    }
  };

  return (
    <div className="space-y-4">
      <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
        Contact Details
      </h2>

      <div>
        <label htmlFor="wiz-name" className="mb-1 block text-sm font-medium">
          Name <span className="text-[var(--flow-status-error)]">*</span>
        </label>
        <input
          ref={nameRef}
          id="wiz-name"
          type="text"
          value={data.name}
          onChange={handleNameChange}
          onKeyDown={handleKeyDown}
          maxLength={200}
          enterKeyHint="next"
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
          placeholder="Client contact name"
          autoFocus
        />
      </div>

      <div>
        <label htmlFor="wiz-email" className="mb-1 block text-sm font-medium">Email</label>
        <input
          id="wiz-email"
          type="email"
          value={data.email ?? ''}
          onChange={handleEmailChange}
          enterKeyHint="next"
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
          placeholder="optional"
        />
        {duplicateWarning && (
          <p className="mt-1 text-sm text-[var(--flow-status-warning)]" role="alert">
            A client with this email already exists ({duplicateWarning.clientName}).
            <a href={`/clients/${duplicateWarning.clientId}`} className="ml-1 underline">View existing</a>
          </p>
        )}
      </div>

      <div>
        <label htmlFor="wiz-phone" className="mb-1 block text-sm font-medium">Phone</label>
        <input
          id="wiz-phone"
          type="text"
          value={data.phone ?? ''}
          onChange={handlePhoneChange}
          maxLength={50}
          enterKeyHint="next"
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
          placeholder="optional"
        />
      </div>

      <div>
        <label htmlFor="wiz-company" className="mb-1 block text-sm font-medium">Company</label>
        <input
          id="wiz-company"
          type="text"
          value={data.company_name ?? ''}
          onChange={handleCompanyChange}
          maxLength={200}
          enterKeyHint="next"
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
          placeholder="optional"
        />
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={handleNext}
          disabled={!isNameValid || checkingDuplicate}
          className="min-h-[44px] min-w-[44px] rounded-md bg-[var(--flow-accent-primary)] px-6 py-2 text-sm font-medium text-[var(--flow-accent-primary-text)] disabled:opacity-50 sm:w-auto w-full"
        >
          {checkingDuplicate ? 'Checking...' : 'Next'}
        </button>
      </div>
    </div>
  );
}
