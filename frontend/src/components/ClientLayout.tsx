'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import AIChatPanel from './AIChatPanel';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [aiOpen, setAiOpen] = useState(false);

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
