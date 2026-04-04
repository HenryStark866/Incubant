import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // Si es un error de carga de módulos (común tras un deploy en Vercel)
    // intentamos recargar automáticamente una vez si no se ha hecho ya.
    const isChunkError = /Failed to fetch dynamically imported module|Loading chunk|chunkLoadError/i.test(error.message);
    if (isChunkError && !sessionStorage.getItem('last_chunk_error_reload')) {
      sessionStorage.setItem('last_chunk_error_reload', Date.now().toString());
      console.warn('Detectado error de carga de módulo. Recargando página...');
      window.location.reload();
    }
  }

  private handleReset = () => {
    sessionStorage.removeItem('last_chunk_error_reload');
    localStorage.clear();
    sessionStorage.clear();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
        }
      });
    }
    // Forzar recarga completa desde el servidor
    window.location.href = window.location.origin + '?reload=' + Date.now();
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F5F7] flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="bg-white p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl border border-red-100 flex flex-col items-center">
            <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <h1 className="text-2xl font-black text-[#1A1A1A] mb-2 tracking-tight">Error de Pantalla</h1>
            <p className="text-gray-500 mb-8 font-medium text-sm">
              La aplicación detectó un problema y no pudo cargar correctamente. Esto suele deberse a configuraciones antiguas o caché corrupta.
            </p>
            {this.state.error && (
               <div className="bg-gray-50 p-4 rounded-2xl mb-6 w-full text-left text-[10px] overflow-auto border border-gray-100">
                 <code className="text-red-600 font-mono font-bold">{this.state.error.toString()}</code>
               </div>
            )}
            <button 
              onClick={this.handleReset}
              className="w-full bg-[#f5a623] hover:bg-[#e6951f] text-white font-black py-4 px-6 rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 uppercase tracking-widest text-sm"
            >
              <RefreshCw size={20} />
              Limpiar y Reiniciar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
