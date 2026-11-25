import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { ComposeModal } from './components/ComposeModal';
import { LoginPage } from './pages/LoginPage';
import { ScheduledPage } from './pages/ScheduledPage';
import { SentPage } from './pages/SentPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { MonitoringPage } from './pages/MonitoringPage';

const ProtectedLayout: React.FC<{
  children: (props: { onOpenCompose: () => void }) => React.ReactNode;
}> = ({ children }) => {
  const { user, loading } = useAuth();
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="size-6 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen bg-white font-sans text-ink p-2 sm:p-3 gap-3 sm:gap-5 overflow-hidden select-none">
      {/* Figma Left Sidebar */}
      <Sidebar onOpenCompose={() => setIsComposeOpen(true)} />

      {/* Main Mailbox Content Area */}
      <main className="min-w-0 flex-1 overflow-hidden flex flex-col pr-1 sm:pr-3">
        {children({ onOpenCompose: () => setIsComposeOpen(true) })}
      </main>

      {/* Compose Campaign Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/scheduled"
            element={
              <ProtectedLayout>
                {({ onOpenCompose }) => <ScheduledPage onOpenCompose={onOpenCompose} />}
              </ProtectedLayout>
            }
          />

          <Route
            path="/sent"
            element={
              <ProtectedLayout>
                {() => <SentPage />}
              </ProtectedLayout>
            }
          />

          <Route
            path="/integrations"
            element={
              <ProtectedLayout>
                {() => <IntegrationsPage />}
              </ProtectedLayout>
            }
          />

          <Route
            path="/monitoring"
            element={
              <ProtectedLayout>
                {() => <MonitoringPage />}
              </ProtectedLayout>
            }
          />

          <Route path="/" element={<Navigate to="/scheduled" replace />} />
          <Route path="/dashboard" element={<Navigate to="/scheduled" replace />} />
          <Route path="*" element={<Navigate to="/scheduled" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
