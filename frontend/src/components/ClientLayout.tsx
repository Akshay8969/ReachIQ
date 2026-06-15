'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import AIChatPanel from './AIChatPanel';
import { useAuth } from '@/context/AuthContext';

const AUTH_ROUTES = ['/login', '/register'];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = AUTH_ROUTES.includes(pathname);

  useEffect(() => {
    if (!isLoading && !user && !isAuthPage) {
      router.push('/login');
    }
  }, [user, isLoading, isAuthPage, router]);

  // Show auth pages without sidebar
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Show a loading screen while checking auth state
  if (isLoading || (!user && !isAuthPage)) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar onAiToggle={() => setAiOpen(o => !o)} aiOpen={aiOpen} />
      <main
        className="main-content"
        style={{ marginRight: aiOpen ? 380 : 0, transition: 'margin-right 0.3s ease' }}
      >
        <div className="page-container">
          {children}
        </div>
      </main>
      <AIChatPanel open={aiOpen} onClose={() => setAiOpen(false)} />
    </div>
  );
}

