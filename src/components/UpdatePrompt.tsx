// src/components/UpdatePrompt.tsx
// Componente que detecta nuevas versiones del PWA y permite actualizar automáticamente

import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updating, setUpdating] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('[PWA] Service Worker registrado:', r);
      // Verificar actualizaciones cada 60 segundos
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Error al registrar Service Worker:', error);
    },
    onNeedRefresh() {
      setShowPrompt(true);
      // Auto-actualizar después de 10 segundos si el usuario no hace nada
      setTimeout(() => {
        handleUpdate();
      }, 10000);
    },
    onOfflineReady() {
      console.log('[PWA] App lista para uso offline');
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true);
    }
  }, [needRefresh]);

  const handleUpdate = async () => {
    if (updating) return;
    setUpdating(true);
    await updateServiceWorker(true);
  };

  if (!showPrompt) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid #f5a62380',
        borderRadius: '16px',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,166,35,0.1)',
        maxWidth: '90vw',
        width: '400px',
        animation: 'slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes spinIcon {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* Icono */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #f5a623, #e8960f)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '22px',
        }}
      >
        {updating ? (
          <span
            style={{
              display: 'inline-block',
              animation: 'spinIcon 0.7s linear infinite',
            }}
          >
            ⟳
          </span>
        ) : (
          '🔄'
        )}
      </div>

      {/* Texto */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            color: '#f1f5f9',
            fontWeight: 700,
            fontSize: '14px',
            marginBottom: '2px',
          }}
        >
          {updating ? 'Actualizando...' : '¡Nueva versión disponible!'}
        </div>
        <div style={{ color: '#94a3b8', fontSize: '12px' }}>
          {updating
            ? 'Recargando la aplicación'
            : 'Se instalará automáticamente en 10s'}
        </div>
      </div>

      {/* Botón */}
      {!updating && (
        <button
          onClick={handleUpdate}
          style={{
            background: 'linear-gradient(135deg, #f5a623, #e8960f)',
            color: '#0f172a',
            border: 'none',
            borderRadius: '10px',
            padding: '8px 16px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'opacity 0.2s',
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseOut={e => (e.currentTarget.style.opacity = '1')}
        >
          Actualizar
        </button>
      )}
    </div>
  );
}
