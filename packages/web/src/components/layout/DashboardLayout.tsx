import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardLayoutProps {
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto bg-surface-secondary p-4 md:p-6 dark:bg-surface-dark"
          role="main"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
