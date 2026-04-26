'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@flow/ui';
import { CreateClientForm } from './create-client-form';

interface CreateClientDialogProps {
  activeCount: number;
}

export function CreateClientDialog({ activeCount }: CreateClientDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="rounded-md bg-[var(--flow-color-bg-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Add Client
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
        </DialogHeader>
        <CreateClientForm
          activeCount={activeCount}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
