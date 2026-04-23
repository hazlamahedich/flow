export const STEPS = [
  'welcome',
  'agent-demo',
  'create-client',
  'log-time',
] as const;

export const COMPLETION_STEP = 'completion' as const;

export type StepSlug =
  | (typeof STEPS)[number]
  | typeof COMPLETION_STEP;

const STEP_LABELS: Record<(typeof STEPS)[number], string> = {
  welcome: 'Welcome',
  'agent-demo': 'Agent Demo',
  'create-client': 'Create Client',
  'log-time': 'Log Time',
} as const;

export function isValidStep(slug: string): slug is StepSlug {
  return (
    (STEPS as readonly string[]).includes(slug) ||
    slug === COMPLETION_STEP
  );
}

export function getStepIndex(slug: StepSlug): number {
  if (slug === COMPLETION_STEP) return STEPS.length;
  return STEPS.indexOf(slug);
}

export function getNextStep(current: StepSlug): StepSlug | null {
  if (current === STEPS[STEPS.length - 1]) return COMPLETION_STEP;
  if (current === COMPLETION_STEP) return null;
  const index = getStepIndex(current);
  const next = STEPS[index + 1];
  return next ?? null;
}

export function getPreviousStep(current: StepSlug): StepSlug | null {
  if (current === COMPLETION_STEP) return STEPS[STEPS.length - 1] ?? null;
  const index = getStepIndex(current);
  if (index <= 0) return null;
  return STEPS[index - 1] ?? null;
}

export function getStepLabel(slug: StepSlug): string {
  if (slug === COMPLETION_STEP) return 'Complete';
  return STEP_LABELS[slug];
}

export function getTotalSteps(): number {
  return STEPS.length;
}
