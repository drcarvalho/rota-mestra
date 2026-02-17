import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Play,
  Moon,
  Sun,
  Trash2,
  X,
  RefreshCw,
  ChevronRight,
  Calculator,
  ShieldCheck,
  AlertTriangle,
  History,
  LayoutDashboard,
  Settings as SettingsIcon,
  HelpCircle
} from 'lucide-react';
import { parseFile } from './utils/fileParser';
import { geocodeBatch } from './utils/geocoding';
import { optimizeRoute } from './utils/optimizer';
import MapView from './components/MapView';
import FileUploader from './components/FileUploader';
import RouteDetails from './components/RouteDetails';
import './App.css';
import confetti from 'canvas-confetti';

function App() {
  const hasValidCoords = (item) =>
    Boolean(item?.coords && Number.isFinite(item.coords.lat) && Number.isFinite(item.coords.lon));

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, uploading, geocoding, optimizing, ready
  const [progress, setProgress] = useState(0);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [roundTrip, setRoundTrip] = useState(false);
  const [startPointId, setStartPointId] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('optimizer'); // optimizer, settings, history

  // Theme Management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setIsDarkMode(savedTheme === 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode ? 'dark' : 'light';
    setIsDarkMode(!isDarkMode);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Upload Logic
  const handleFileUpload = useCallback(async (file) => {
    try {
      setError(null);
      setStatus('uploading');
      const data = await parseFile(file);
      if (data.length === 0) throw new Error('O arquivo parece estar vazio ou sem colunas de endereço identificáveis.');
      setItems(data);
      setStartPointId(data[0]?.id ?? null);
      setStatus('idle');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  }, []);

  // Main Processing Engine
  const runRouteOptimizer = async () => {
    if (items.length === 0) return;
    setError(null);
    setProgress(0);

    try {
      // Phase 1: Geocoding (if needed)
      const needsGeocoding = items.filter((i) => !hasValidCoords(i));
      let geocodedList = [...items];

      if (needsGeocoding.length > 0) {
        setStatus('geocoding');
        const results = await geocodeBatch(items, (current, total) => {
          setProgress(Math.round((current / total) * 100));
        });
        geocodedList = results;
      }

      const successfulItems = geocodedList.filter((item) => item.status === 'success' || hasValidCoords(item));
      if (successfulItems.length === 0) {
        throw new Error('Não foi possível localizar nenhum dos endereços no mapa. Verifique a ortografia.');
      }

      // Phase 2: Route Optimization (TSP)
      setStatus('optimizing');
      setProgress(50);
      const startIndexFromId = successfulItems.findIndex(item => String(item.id) === String(startPointId));
      const safeStartIndex = startIndexFromId >= 0 ? startIndexFromId : 0;
      const optimized = await optimizeRoute(successfulItems, { roundTrip, startIndex: safeStartIndex });
      setProgress(100);

      setItems(optimized.orderedItems);
      setRouteInfo(optimized);
      setStatus('ready');

      // Success Event
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        ticks: 200,
        colors: ['#2563eb', '#10b981', '#60a5fa']
      });

    } catch (err) {
      setError(err.message);
      setStatus('idle');
      console.error('Core Logic Failure:', err);
    }
  };

  const resetProject = () => {
    if (confirm('Deseja limpar todos os dados e começar de novo?')) {
      setItems([]);
      setRouteInfo(null);
      setStartPointId(null);
      setStatus('idle');
      setProgress(0);
      setError(null);
    }
  };

  return (
    <div className="app-container">
      {/* PROFESSIONAL NAVBAR */}
      <header>
        <div style={{ maxWidth: '1440px', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <Truck size={24} strokeWidth={2.5} />
            </div>
            <div className="hide-mobile">
              <h1 style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--primary)' }}>RotaMestra <span style={{ color: 'var(--text-main)' }}>Pro</span></h1>
              <p style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Logística Urbana Avançada</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', background: 'var(--primary-light)', padding: '4px', borderRadius: '10px', marginRight: '0.5rem' }}>
              <button className={`btn btn-icon ${activeTab === 'optimizer' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('optimizer')} style={{ width: '36px', height: '36px' }}>
                <LayoutDashboard size={18} />
              </button>
              <button className={`btn btn-icon ${activeTab === 'settings' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('settings')} style={{ width: '36px', height: '36px' }}>
                <SettingsIcon size={18} />
              </button>
            </div>

            <button className="btn btn-outline btn-icon" onClick={toggleTheme} style={{ borderRadius: '12px' }}>
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {items.length > 0 && (
              <button className="btn btn-primary" onClick={resetProject} style={{ background: 'var(--error)', border: 'none', borderRadius: '12px' }}>
                <Trash2 size={18} /> <span className="hide-mobile">Novo</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* SIDEBAR ZONE */}
        <aside className="sidebar-scroll">

          {/* 1. WELCOME & DATA INPUT */}
          {status === 'idle' && items.length === 0 && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Bem-vindo ao Futuro das Entregas.</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Otimize suas rotas de entrega em segundos com tecnologia aeroespacial para logística.</p>
              </div>
              <FileUploader onUpload={handleFileUpload} />

              <div className="card" style={{ marginTop: '1.5rem', borderLeft: '4px solid var(--primary)', background: 'var(--primary-light)' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <ShieldCheck size={24} color="var(--primary)" />
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Privacidade Garantida</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Seus dados são processados localmente e nunca armazenados em nossos servidores.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. ERROR BOUNDARY UI */}
          {error && (
            <div className="card animate-fade-in" style={{ border: '1px solid var(--error)', background: 'var(--error-light)' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <AlertTriangle color="var(--error)" size={20} />
                <div>
                  <h4 style={{ color: 'var(--error)', fontWeight: 700 }}>Erro no Processamento</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '4px' }}>{error}</p>
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', background: 'var(--error)' }} onClick={() => setError(null)}>
                Corrigir e Tentar Novamente
              </button>
            </div>
          )}

          {/* 3. LOADING & PROGRESS */}
          {(status === 'geocoding' || status === 'optimizing' || status === 'uploading') && (
            <div className="card animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontWeight: 800 }}>{status === 'geocoding' ? 'Mapeando Endereços' : status === 'optimizing' ? 'Inteligência de Rota' : 'Processando Arquivo'}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Executando algoritmos TSP v4.2</p>
                </div>
                <div className="loading-spinner" />
              </div>

              <div style={{ background: 'var(--border)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{
                  background: 'linear-gradient(90deg, var(--primary), #60a5fa)',
                  height: '100%',
                  width: `${progress}%`,
                  transition: 'width 0.5s ease-out'
                }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>{progress}% Concluído</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{items.length} pontos</span>
              </div>
            </div>
          )}

          {/* 4. SETTINGS & PRE-CALCULATION */}
          {items.length > 0 && status === 'idle' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card">
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontWeight: 800 }}>Configuração da Rota</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ajuste os parâmetros para máxima eficiência</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="card" style={{ padding: '1rem', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Ponto de Partida</span>
                      <select
                        value={startPointId ?? ''}
                        onChange={(e) => setStartPointId(e.target.value)}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          padding: '0.625rem 0.75rem',
                          background: 'var(--card)',
                          color: 'var(--text-main)',
                          fontSize: '0.85rem'
                        }}
                      >
                        {items.map((item, idx) => (
                          <option key={item.id || idx} value={String(item.id)}>
                            {idx + 1}. {item.label || item.address}
                          </option>
                        ))}
                      </select>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        A rota será otimizada a partir desse endereço.
                      </p>
                    </label>
                  </div>

                  <div className="card" style={{ padding: '1rem', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={roundTrip}
                        onChange={(e) => setRoundTrip(e.target.checked)}
                        style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                      />
                      <div>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Retornar ao Início</span>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ideal para delivery com retorno à base/LJ.</p>
                      </div>
                    </label>
                  </div>
                </div>

                <button className="btn btn-primary" onClick={runRouteOptimizer} style={{ width: '100%', marginTop: '1.25rem', padding: '1.25rem' }}>
                  <Calculator size={22} /> CALCULAR MELHOR ROTA
                </button>
              </div>

              <div className="card">
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, marginBottom: '1rem' }}>Resumo da Importação ({items.length})</h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {items.map((item, idx) => (
                    <div key={item.id} className="animate-slide-in" style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', width: '20px' }}>{idx + 1}</span>
                      <div style={{ overflow: 'hidden' }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.address}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 5. FINAL RESULTS */}
          {status === 'ready' && routeInfo && (
            <div className="animate-fade-in">
              <RouteDetails items={items} info={routeInfo} />

              <button className="btn btn-outline" style={{ width: '100%', marginTop: '1rem', padding: '1rem', color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={() => setStatus('idle')}>
                <RefreshCw size={18} /> Editar Paradas ou Configuração
              </button>
            </div>
          )}
        </aside>

        {/* MAP ZONE */}
        <section className="map-area">
          <div className="card map-container-inner" style={{ padding: 0, boxShadow: 'var(--shadow-lg)' }}>
            <MapView items={items} routeGeometry={routeInfo?.geometry} />

            {/* Floating Map Overlay */}
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, pointerEvents: 'none' }}>
              <div className="card hide-mobile" style={{ background: 'rgba(var(--card-bg-rgb, 255, 255, 255), 0.9)', backdropFilter: 'blur(8px)', padding: '0.75rem 1rem', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Sistema Live</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>Bauru / SP</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* PRO FOOTER */}
      <footer style={{ background: 'var(--card-bg)', borderTop: '1px solid var(--border)', padding: '1.5rem', zIndex: 10 }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <History size={14} /> <span>Histórico de Rotas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <HelpCircle size={14} /> <span>Central de Ajuda</span>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            &copy; 2026 RotaMestra Pro. A ferramenta preferida dos entregadores de elite.<br />
            <span style={{ opacity: 0.6 }}>Otimizado para logística de última milha no Brasil.</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
