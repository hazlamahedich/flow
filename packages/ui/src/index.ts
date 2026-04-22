export { Button, buttonVariants } from './components/button/button';
export type { ButtonProps } from './components/button/button';
export { Badge, badgeVariants } from './components/badge/badge';
export type { BadgeProps } from './components/badge/badge';
export { Card, CardHeader, CardContent } from './components/card/card';
export { Input } from './components/input/input';
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/dialog/dialog';
export { cn } from './lib/utils';

export { DashboardSection } from './components/dashboard/dashboard-section';
export type { DashboardSectionProps } from './components/dashboard/dashboard-section';
export { DashboardGreeting } from './components/dashboard/dashboard-greeting';
export type { DashboardGreetingProps } from './components/dashboard/dashboard-greeting';
export { EmptyStateCard } from './components/dashboard/empty-state-card';
export type { EmptyStateCardProps } from './components/dashboard/empty-state-card';
export { DashboardContent } from './components/dashboard/dashboard-content';
export type { DashboardContentProps } from './components/dashboard/dashboard-content';

export { WorkspaceShell } from './layouts/workspace-shell';
export type { WorkspaceShellProps } from './layouts/workspace-shell';
export { Sidebar } from './layouts/sidebar';
export { SidebarProvider } from './layouts/sidebar-provider';
export { SidebarErrorBoundary } from './layouts/sidebar-error-boundary';
export { MobileTabBar } from './layouts/mobile-tab-bar';
export { WorkspaceSwitcher } from './layouts/workspace-switcher';
export type { WorkspaceSwitcherProps, WorkspaceItem } from './layouts/workspace-switcher';

export { CommandPalette } from './components/command-palette/command-palette';
export { KeyboardListener, getShortcutRegistry } from './components/command-palette/keyboard-listener';
export { ShortcutOverlay } from './components/command-palette/shortcut-overlay';
export { UndoToast } from './components/command-palette/undo-toast';
export { useFocusTrap } from './hooks/use-focus-trap';
export { useDebouncedCallback } from './hooks/use-debounced-callback';
export { useReducedMotion } from './hooks/use-reduced-motion';
export { useShortcut } from './hooks/use-shortcut';

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from './components/ui/command';
