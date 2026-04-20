export const layout = {
  sidebarExpanded: '240px',
  sidebarCollapsed: '56px',
  mainContent: '960px',
  detailPane: '360px',
} as const;

export type Layout = typeof layout;
