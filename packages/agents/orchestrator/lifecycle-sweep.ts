export async function runGraceSweep(): Promise<{
  swept: number;
  failed: number;
  capped: boolean;
}> {
  throw new Error('runGraceSweep not implemented');
}

export async function runSuspensionSweep(): Promise<{
  swept: number;
  failed: number;
  capped: boolean;
}> {
  throw new Error('runSuspensionSweep not implemented');
}

export async function runReconciliation(): Promise<{
  checked: number;
  drift: Array<{
    workspaceId: string;
    fromStatus: string;
    toStatus: string;
    corrected: boolean;
  }>;
  uncorrectable: Array<{ workspaceId: string; reason: string }>;
}> {
  throw new Error('runReconciliation not implemented');
}
