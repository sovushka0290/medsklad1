import { Suspense, lazy } from 'react';
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
