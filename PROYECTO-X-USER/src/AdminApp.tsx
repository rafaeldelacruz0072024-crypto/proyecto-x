import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import DepositsManager from './admin/DepositsManager';
import WithdrawalsManager from './admin/WithdrawalsManager';

const AdminApp: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/';
        return;
      }

      setUser(session.user);

      // Cargar perfil
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileData?.role !== 'admin') {
        alert('Acceso denegado. Solo administradores.');
        await supabase.auth.signOut();
        window.location.href = '/';
        return;
      }

      setProfile(profileData);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <AdminDashboard onNavigate={setActiveSection} />;
      case 'depositos':
        return <DepositsManager />;
      case 'retiros':
        return <WithdrawalsManager />;
      case 'usuarios':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-black text-white mb-4">Usuarios</h2>
            <p className="text-slate-400">Componente en desarrollo</p>
          </div>
        );
      case 'inversiones':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-black text-white mb-4">Inversiones</h2>
            <p className="text-slate-400">Componente en desarrollo</p>
          </div>
        );
      case 'motor-roi':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-black text-white mb-4">Motor ROI</h2>
            <p className="text-slate-400">Componente en desarrollo</p>
          </div>
        );
      case 'bonos':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-black text-white mb-4">Bonos Semanales</h2>
            <p className="text-slate-400">Componente en desarrollo</p>
          </div>
        );
      case 'planes':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-black text-white mb-4">Planes ROI</h2>
            <p className="text-slate-400">Componente en desarrollo</p>
          </div>
        );
      case 'pasarelas':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-black text-white mb-4">Pasarelas</h2>
            <p className="text-slate-400">Componente en desarrollo</p>
          </div>
        );
      case 'ajustes':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-black text-white mb-4">Ajustes</h2>
            <p className="text-slate-400">Componente en desarrollo</p>
          </div>
        );
      default:
        return <AdminDashboard onNavigate={setActiveSection} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Cargando Admin Panel...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      userRole={profile?.role || 'admin'}
    >
      {renderSection()}
    </AdminLayout>
  );
};

export default AdminApp;
