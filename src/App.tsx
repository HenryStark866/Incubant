/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import DashboardScreen from './screens/DashboardScreen';
import CameraScreen from './screens/CameraScreen';
import FormScreen from './screens/FormScreen';
import LoginScreen from './screens/LoginScreen';
import SupervisorDashboard from './screens/SupervisorDashboard';
import { useMachineStore } from './store/useMachineStore';
import { Smartphone, Monitor } from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<'mobile' | 'supervisor'>('mobile');
  
  const activeMachineId = useMachineStore(state => state.activeMachineId);
  const capturedPhoto = useMachineStore(state => state.capturedPhoto);
  const currentUser = useMachineStore(state => state.currentUser);

  if (viewMode === 'supervisor') {
    return (
      <div className="relative h-screen w-full">
        <SupervisorDashboard />
        {/* View Toggle Button */}
        <button 
          onClick={() => setViewMode('mobile')}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 font-bold z-50 transition-all"
        >
          <Smartphone size={20} />
          Ver App Operario
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 relative">
      {/* View Toggle Button */}
      <button 
        onClick={() => setViewMode('supervisor')}
        className="absolute top-6 right-6 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 font-bold z-50 transition-all border border-slate-700"
      >
        <Monitor size={20} className="text-blue-400" />
        Panel Supervisor
      </button>

      {/* Mobile Simulator Wrapper */}
      <div className="w-full max-w-[400px] h-[800px] max-h-[90vh] bg-black rounded-[3rem] p-2 shadow-2xl relative overflow-hidden ring-4 ring-gray-800">
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-7 bg-black z-50 rounded-b-3xl w-40 mx-auto flex justify-center items-end pb-1">
          <div className="w-12 h-1.5 bg-gray-800 rounded-full"></div>
        </div>
        
        {/* Screen Content */}
        <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden relative">
          {!currentUser ? (
            <LoginScreen />
          ) : activeMachineId ? (
            capturedPhoto ? <FormScreen /> : <CameraScreen />
          ) : (
            <DashboardScreen />
          )}
        </div>
      </div>
    </div>
  );
}

