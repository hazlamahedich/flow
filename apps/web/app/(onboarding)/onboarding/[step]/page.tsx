import { redirect } from 'next/navigation';
import { isValidStep, COMPLETION_STEP, type StepSlug } from '../_lib/steps';
import { WizardShell } from '../_components/wizard-shell';
import { WelcomeStep } from '../_components/steps/welcome-step';
import { AgentDemoStep } from '../_components/steps/agent-demo-step';
import { CreateClientForm } from '../_components/steps/create-client-form';
import { LogTimeFormWithSuspense } from '../_components/steps/log-time-form';
import { CompletionStep } from '../_components/steps/completion-step';

const STEP_COMPONENTS: Record<StepSlug, React.ComponentType> = {
  welcome: WelcomeStep,
  'agent-demo': AgentDemoStep,
  'create-client': CreateClientForm,
  'log-time': LogTimeFormWithSuspense,
  [COMPLETION_STEP]: CompletionStep,
};

interface StepPageProps {
  params: Promise<{ step: string }>;
}

export default async function StepPage({ params }: StepPageProps) {
  const { step } = await params;

  if (!isValidStep(step)) {
    redirect('/onboarding/welcome');
  }

  const StepComponent = STEP_COMPONENTS[step];
  return (
    <WizardShell currentStep={step}>
      <StepComponent />
    </WizardShell>
  );
}
