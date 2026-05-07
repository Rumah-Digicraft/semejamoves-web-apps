import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Funminton from './pages/Funminton';
import FunmintonDetail from './pages/FunmintonDetail';
import Padel from './pages/Padel';
import PadelDetail from './pages/PadelDetail';
import Lapkeu from './pages/Lapkeu';
import PublicFunminton from './pages/PublicFunminton';
import PublicPadel from './pages/PublicPadel';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/f/:token" element={<PublicFunminton />} />
          <Route path="/p/:token" element={<PublicPadel />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/funminton" element={<Funminton />} />
              <Route path="/funminton/sessions/:id" element={<FunmintonDetail />} />
              <Route path="/padel" element={<Padel />} />
              <Route path="/padel/sessions/:id" element={<PadelDetail />} />
              <Route path="/lapkeu" element={<Lapkeu />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
