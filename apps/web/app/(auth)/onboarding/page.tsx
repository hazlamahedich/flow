export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--flow-color-bg-primary)]">
      <div className="w-full max-w-md rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] p-6">
        <h1 className="mb-4 text-xl font-semibold text-[var(--flow-color-text-primary)]">
          Create your workspace
        </h1>
        <form className="space-y-4">
          <div>
            <label
              htmlFor="workspace-name"
              className="mb-1 block text-sm font-medium text-[var(--flow-color-text-secondary)]"
            >
              Workspace name
            </label>
            <input
              id="workspace-name"
              name="name"
              type="text"
              required
              placeholder="My Agency"
              className="w-full rounded-md border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-primary)] px-3 py-2 text-sm text-[var(--flow-color-text-primary)] placeholder:text-[var(--flow-color-text-tertiary)] focus:border-[var(--flow-color-accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--flow-color-accent-primary)]"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--flow-color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Create workspace
          </button>
        </form>
      </div>
    </div>
  );
}
