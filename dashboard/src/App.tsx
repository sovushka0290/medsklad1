import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Skeleton from './components/Skeleton';
import { ErrorToastContainer } from './components/ErrorToast';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Procedures = lazy(() => import('./pages/Procedures'));
const Reports = lazy(() => import('./pages/Reports'));
const Import = lazy(() => import('./pages/Import'));
const UsersPage = lazy(() => import('./pages/Users'));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings'));

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  return token ? <Layout>{children}</Layout> : <Navigate to="/login" />;
};

const FallbackLoader = () => (
  <div className="p-8 space-y-6 w-full max-w-7xl mx-auto">
    <div className="flex justify-between items-center">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-32" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <Skeleton variant="rect" count={4} className="h-28" />
    </div>
    <Skeleton variant="rect" className="h-96" />
  </div>
);

function App() {
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    let lastActive = Date.now();

    const updateActivity = () => {
      lastActive = Date.now();
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    const interval = setInterval(() => {
      if (Date.now() - lastActive > 30 * 60 * 1000) { // 30 минут
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }, 10000); // Проверка каждые 10 секунд

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      clearInterval(interval);
    };
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<FallbackLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/inventory" element={<PrivateRoute><Inventory /></PrivateRoute>} />
            <Route path="/procedures" element={<PrivateRoute><Procedures /></PrivateRoute>} />
            <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
            <Route path="/import" element={<PrivateRoute><Import /></PrivateRoute>} />
            <Route path="/users" element={<PrivateRoute><UsersPage /></PrivateRoute>} />
            <Route path="/settings/notifications" element={<PrivateRoute><NotificationSettings /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </Router>
      {/* Global API error toasts — rendered outside Router to survive route changes */}
      <ErrorToastContainer />
    </ErrorBoundary>
  );
}

export default App;
