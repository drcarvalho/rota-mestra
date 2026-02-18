import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import {
  Play,
  RefreshCw,
  Calculator,
  AlertTriangle,
  Navigation,
  Wifi,
  WifiOff
} from 'lucide-react';
import { parseFile } from './utils/fileParser';
import { geocodeBatch } from './utils/geocoding';
import { optimizeRoute } from './utils/optimizer';
import FileUploader from './components/FileUploader';
import RouteDetails from './components/RouteDetails';
import Button from './components/ui/Button';
import Card from './components/ui/Card';
import StatusBadge from './components/ui/StatusBadge';
import TopBar from './components/app/TopBar';
import HistoryPanel from './components/app/HistoryPanel';
import SettingsPanel from './components/app/SettingsPanel';
import { useWorkspacePersistence, useRouteHistory } from './hooks/useRoutePersistence';
import './App.css';
import confetti from 'canvas-confetti';

const MapView = lazy(() => import('./components/MapView'));

const WORKSPACE_STORAGE_KEY = 'rota_mestra_workspace_v1';
const ROUTE_HISTORY_STORAGE_KEY = 'rota_mestra_history_v1';

const haversineKm = (c1, c2) => {
  if (!c1 || !c2) return 0;
  const R = 6371;
  const dLat = (c2.lat - c1.lat) * Math.PI / 180;
  const dLon = (c2.lon - c1.lon) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getHaversineDistance = (routeItems, roundTrip = false) => {
  if (!Array.isArray(routeItems) || routeItems.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < routeItems.length - 1; i++) {
    total += haversineKm(routeItems[i].coords, routeItems[i + 1].coords);
  }
  if (roundTrip) total += haversineKm(routeItems[routeItems.length - 1].coords, routeItems[0].coords);
  return total;
};

const buildInitialStopStatuses = (routeItems) => {
  const statuses = {};
  routeItems.forEach((item, idx) => {
    statuses[String(item.id)] = idx === 0 ? 'done' : 'pending';
  });
  return statuses;
};

function App() {
  const hasValidCoords = (item) =>
    Boolean(item?.coords && Number.isFinite(item.coords.lat) && Number.isFinite(item.coords.lon));

  const sidebarRef = useRef(null);
  const mapRef = useRef(null);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, uploading, geocoding, optimizing, ready
  const [progress, setProgress] = useState(0);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [roundTrip, setRoundTrip] = useState(false);
  const [startPointId, setStartPointId] = useState(null);
  const [optimizeBy, setOptimizeBy] = useState('distance'); // distance, duration
  const [stopStatuses, setStopStatuses] = useState({});
  const [isFieldMode, setIsFieldMode] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [isMobileViewport, setIsMobileViewport] = useState(typeof window !== 'undefined' ? window.innerWidth <= 900 : false);
  const [mobileView, setMobileView] = useState('panel'); // panel, map
  const [toast, setToast] = useState(null); // { message, type }
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('optimizer'); // optimizer, settings, history
  const { routeHistory, persistHistory } = useRouteHistory(ROUTE_HISTORY_STORAGE_KEY);

  // Theme Management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setIsDarkMode(savedTheme === 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  useWorkspacePersistence({
    storageKey: WORKSPACE_STORAGE_KEY,
    items,
    routeInfo,
    roundTrip,
    startPointId,
    optimizeBy,
    stopStatuses,
    status,
    setItems,
    setRouteInfo,
    setRoundTrip,
    setStartPointId,
    setOptimizeBy,
    setStopStatuses,
    setStatus
  });

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    const onResize = () => setIsMobileViewport(window.innerWidth <= 900);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    if (status === 'ready') {
      setMobileView('panel');
      setIsFieldMode(false);
    }
  }, [isMobileViewport, status]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (message, type = 'info') => setToast({ message, type });

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
      setStopStatuses({});
      setIsFieldMode(false);
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
      const optimized = await optimizeRoute(successfulItems, {
        roundTrip,
        startIndex: safeStartIndex,
        optimizeBy
      });
      const baselineKm = getHaversineDistance(successfulItems, roundTrip);
      const optimizedKm = getHaversineDistance(optimized.orderedItems, roundTrip);
      const gainRatio = baselineKm > 0 ? ((baselineKm - optimizedKm) / baselineKm) * 100 : 0;
      const roadBaseline = optimized?.meta?.baselineCost;
      const roadSelected = optimized?.meta?.selectedCost;
      const roadGainPercent = Number.isFinite(roadBaseline) && roadBaseline > 0 && Number.isFinite(roadSelected)
        ? Math.max(0, ((roadBaseline - roadSelected) / roadBaseline) * 100)
        : null;
      setProgress(100);

      setItems(optimized.orderedItems);
      setRouteInfo({
        ...optimized,
        quality: {
          baselineKm,
          optimizedKm,
          gainPercent: Math.max(0, gainRatio),
          roadGainPercent
        }
      });
      setStopStatuses(buildInitialStopStatuses(optimized.orderedItems));
      setStatus('ready');
      if (isMobileViewport) setMobileView('map');

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
    if (window.confirm('Deseja limpar todos os dados e começar de novo?')) {
      setItems([]);
      setRouteInfo(null);
      setStartPointId(null);
      setOptimizeBy('distance');
      setStopStatuses({});
      setStatus('idle');
      setProgress(0);
      setError(null);
      setMobileView('panel');
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
  };

  const clearSavedWorkspace = () => {
    localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    setItems([]);
    setRouteInfo(null);
    setRoundTrip(false);
    setStartPointId(null);
    setOptimizeBy('distance');
    setStopStatuses({});
    setStatus('idle');
    setProgress(0);
    setError(null);
    showToast('Sessão local removida.', 'success');
  };

  const getNextPendingIndex = () => {
    if (!items.length) return -1;
    for (let idx = 1; idx < items.length; idx++) {
      const stopId = String(items[idx].id);
      if (stopStatuses[stopId] !== 'done') return idx;
    }
    return -1;
  };

  const markStopStatus = (idx, nextStatus) => {
    const item = items[idx];
    if (!item || idx === 0) return;
    const stopId = String(item.id);
    setStopStatuses((current) => ({ ...current, [stopId]: nextStatus }));
    showToast(nextStatus === 'done' ? 'Entrega marcada como concluída.' : 'Entrega marcada como falha.', nextStatus === 'done' ? 'success' : 'error');
  };

  const saveCurrentRouteToHistory = () => {
    if (!items.length || !routeInfo) return;
    const now = new Date();
    const entry = {
      id: `route_${now.getTime()}`,
      createdAt: now.toISOString(),
      title: `Rota ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      items,
      routeInfo,
      roundTrip,
      optimizeBy,
      startPointId
    };
    const nextHistory = [entry, ...routeHistory].slice(0, 20);
    persistHistory(nextHistory);
    showToast('Rota salva no histórico.', 'success');
  };

  const loadHistoryRoute = (entry) => {
    setItems(entry.items || []);
    setRouteInfo(entry.routeInfo || null);
    setRoundTrip(Boolean(entry.roundTrip));
    setOptimizeBy(entry.optimizeBy === 'duration' ? 'duration' : 'distance');
    setStartPointId(entry.startPointId ?? entry.items?.[0]?.id ?? null);
    setStopStatuses(buildInitialStopStatuses(entry.items || []));
    setStatus(entry.routeInfo ? 'ready' : 'idle');
    setActiveTab('optimizer');
  };

  const clearHistory = () => {
    persistHistory([]);
  };

  const openCurrentStopNavigation = () => {
    if (!currentStop?.coords) return;
    const stop = `${currentStop.coords.lat},${currentStop.coords.lon}`;
    const url = `https://waze.com/ul?ll=${stop}&navigate=yes`;
    window.open(url, '_blank');
    showToast('Abrindo navegação para próxima parada.', 'info');
  };

  const goToSidebar = () => {
    if (isMobileViewport) setMobileView('panel');
    sidebarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const goToMap = () => {
    if (isMobileViewport) setMobileView('map');
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const nextPendingIndex = getNextPendingIndex();
  const currentStop = nextPendingIndex > 0 ? items[nextPendingIndex] : null;
  const progressDone = Math.max(0, items.slice(1).filter((item) => stopStatuses[String(item.id)] === 'done').length);
  const progressTotal = Math.max(0, items.length - 1);
  const workflowStep = status === 'ready' ? 3 : items.length > 0 ? 2 : 1;
  const isRouteReady = status === 'ready' && items.length > 0;
  const canNavigateNow = isRouteReady && Boolean(currentStop?.coords);
  const handlePrimaryMobileAction = () => {
    if (canNavigateNow) {
      openCurrentStopNavigation();
      return;
    }
    runRouteOptimizer();
  };

  return (
    <div className="app-container">
      <TopBar
        isMobileViewport={isMobileViewport}
        mobileView={mobileView}
        setMobileView={setMobileView}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        toggleTheme={toggleTheme}
        isDarkMode={isDarkMode}
        status={status}
        isFieldMode={isFieldMode}
        setIsFieldMode={setIsFieldMode}
        itemsLength={items.length}
        onReset={resetProject}
      />

      <main className="main-content">
        {/* SIDEBAR ZONE */}
        <aside className={`sidebar-scroll ${isMobileViewport && mobileView === 'map' ? 'mobile-hidden' : ''}`} ref={sidebarRef}>
          <Card>
            <h4 style={{ fontWeight: 800, marginBottom: '0.75rem', fontSize: '0.9rem' }}>Fluxo da Operação</h4>
            <div className="stepper-grid">
              <div className={`step-chip ${workflowStep >= 1 ? 'step-chip-active' : ''}`}>1. Importar</div>
              <div className={`step-chip ${workflowStep >= 2 ? 'step-chip-active' : ''}`}>2. Configurar</div>
              <div className={`step-chip ${workflowStep >= 3 ? 'step-chip-active' : ''}`}>3. Navegar</div>
            </div>
          </Card>

          {activeTab === 'history' && (
            <HistoryPanel routeHistory={routeHistory} onClear={clearHistory} onLoad={loadHistoryRoute} />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel onClearWorkspace={clearSavedWorkspace} onClearHistory={clearHistory} />
          )}

          {/* 1. WELCOME & DATA INPUT */}
          {activeTab === 'optimizer' && status === 'idle' && items.length === 0 && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Importe e otimize sua rota.</h2>
              </div>
              <FileUploader onUpload={handleFileUpload} onValidationError={(message) => showToast(message, 'error')} />
            </div>
          )}

          {/* 2. ERROR BOUNDARY UI */}
          {activeTab === 'optimizer' && error && (
            <div className="card animate-fade-in" style={{ border: '1px solid var(--error)', background: 'var(--error-light)' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <AlertTriangle color="var(--error)" size={20} />
                <div>
                  <h4 style={{ color: 'var(--error)', fontWeight: 700 }}>Erro no processamento</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '4px' }}>{error}</p>
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: '1rem', width: '100%', background: 'var(--error)' }} onClick={() => setError(null)}>
                Tentar novamente
              </button>
            </div>
          )}

          {/* 3. LOADING & PROGRESS */}
          {activeTab === 'optimizer' && (status === 'geocoding' || status === 'optimizing' || status === 'uploading') && (
            <div className="card animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontWeight: 800 }}>{status === 'geocoding' ? 'Geocodificando endereços' : status === 'optimizing' ? 'Otimizando rota' : 'Processando arquivo'}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Processamento em andamento</p>
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
          {activeTab === 'optimizer' && items.length > 0 && status === 'idle' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card">
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ fontWeight: 800 }}>Configurar rota</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div className="card" style={{ padding: '1rem', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Objetivo da Otimização</span>
                      <select
                        value={optimizeBy}
                        onChange={(e) => setOptimizeBy(e.target.value)}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          padding: '0.625rem 0.75rem',
                          background: 'var(--card)',
                          color: 'var(--text-main)',
                          fontSize: '0.85rem'
                        }}
                      >
                        <option value="distance">Menor Distância (km)</option>
                        <option value="duration">Menor Tempo (min)</option>
                      </select>
                    </label>
                  </div>

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
                      </div>
                    </label>
                  </div>
                </div>

                <button className="btn btn-primary mobile-main-action" onClick={runRouteOptimizer} style={{ width: '100%', marginTop: '1.25rem', padding: '1.25rem' }}>
                  <Calculator size={22} /> OTIMIZAR ROTA
                </button>
              </div>

            </div>
          )}

          {/* 5. FINAL RESULTS */}
          {activeTab === 'optimizer' && status === 'ready' && routeInfo && (
            <div className="animate-fade-in">
              <RouteDetails
                items={items}
                info={routeInfo}
                stopStatuses={stopStatuses}
                onMarkDone={(idx) => markStopStatus(idx, 'done')}
                onMarkFailed={(idx) => markStopStatus(idx, 'failed')}
                onCopyAddress={async (address) => {
                  try {
                    await navigator.clipboard?.writeText(address || '');
                    showToast('Endereço copiado.', 'success');
                  } catch {
                    showToast('Não foi possível copiar o endereço.', 'error');
                  }
                }}
              />

              <div className="card" style={{ marginTop: '1rem' }}>
                <h4 style={{ fontWeight: 800, marginBottom: '0.75rem' }}>Modo Entregador</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
                  {progressDone}/{progressTotal} entregas concluídas
                </p>
                <div style={{ background: 'var(--border)', borderRadius: '8px', height: '10px', overflow: 'hidden', marginBottom: '0.9rem' }}>
                  <div style={{ width: `${progressTotal > 0 ? (progressDone / progressTotal) * 100 : 0}%`, height: '100%', background: 'var(--success)', transition: 'width 0.2s ease' }} />
                </div>
                {currentStop ? (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Próxima parada</p>
                    <p style={{ fontWeight: 700, marginBottom: '0.75rem' }}>{currentStop.address}</p>
                    <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.6rem' }} onClick={openCurrentStopNavigation}>
                      <Navigation size={16} /> Abrir navegação
                    </button>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                      <button className="btn btn-primary" onClick={() => markStopStatus(nextPendingIndex, 'done')}>Concluir</button>
                      <button className="btn btn-outline" onClick={() => markStopStatus(nextPendingIndex, 'failed')}>Falha</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 700 }}>Todas as entregas concluídas.</p>
                )}
              </div>

              <div className="card" style={{ marginTop: '1rem' }}>
                <h4 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Qualidade da Rota</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Modo: <b>{routeInfo.optimizeBy === 'duration' ? 'Menor Tempo' : 'Menor Distância'}</b>
                </p>
                <div style={{ marginTop: '0.4rem' }}>
                  <StatusBadge
                    tone={routeInfo.optimizeBy === 'duration' ? 'info' : 'neutral'}
                    label={routeInfo.optimizeBy === 'duration' ? 'Otimização por tempo' : 'Otimização por distância'}
                  />
                </div>
                {routeInfo.quality && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Ganho da rota: <b>{routeInfo.quality.gainPercent.toFixed(1)}%</b>
                  </p>
                )}
                <button className="btn btn-outline" style={{ width: '100%', marginTop: '0.8rem' }} onClick={saveCurrentRouteToHistory}>
                  Salvar no Histórico
                </button>
              </div>

              <button className="btn btn-outline" style={{ width: '100%', marginTop: '1rem', padding: '1rem', color: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={() => setStatus('idle')}>
                <RefreshCw size={18} /> Ajustar rota
              </button>
            </div>
          )}
        </aside>

        {/* MAP ZONE */}
        <section className={`map-area ${isMobileViewport && mobileView === 'panel' ? 'mobile-hidden' : ''}`} ref={mapRef}>
          <div className="card map-container-inner" style={{ padding: 0, boxShadow: 'var(--shadow-lg)' }}>
            <Suspense fallback={<div className="map-loading">Carregando mapa...</div>}>
              <MapView
                items={items}
                routeGeometry={routeInfo?.geometry}
                stopStatuses={stopStatuses}
                nextStopIndex={nextPendingIndex}
                isVisible={!(isMobileViewport && mobileView === 'panel')}
              />
            </Suspense>

            {/* Floating Map Overlay */}
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, pointerEvents: 'none' }}>
              <div className="card hide-mobile" style={{ background: 'rgba(var(--card-bg-rgb, 255, 255, 255), 0.9)', backdropFilter: 'blur(8px)', padding: '0.75rem 1rem', border: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--success)' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Sistema ativo</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>Bauru / SP</span>
                  <span style={{ marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {isOnline ? <Wifi size={12} color="#059669" /> : <WifiOff size={12} color="#dc2626" />}
                    <StatusBadge tone={isOnline ? 'success' : 'error'} label={isOnline ? 'Online' : 'Offline'} />
                  </span>
                </div>
              </div>
            </div>

            {isMobileViewport && mobileView === 'map' && status === 'ready' && currentStop && !isFieldMode && (
              <div className="driver-hud">
                <p className="driver-hud-title">Proxima parada</p>
                <p className="driver-hud-address">{currentStop.address}</p>
                <div className="driver-hud-actions">
                  <button className="btn btn-primary" onClick={openCurrentStopNavigation}>
                    <Navigation size={18} /> Navegar
                  </button>
                  <button className="btn btn-outline" onClick={() => markStopStatus(nextPendingIndex, 'done')}>
                    Concluir
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>&copy; 2026 RotaMestra Pro · Planejamento de entregas de ultima milha</p>
      </footer>

      <div className="mobile-actions">
        <button className="mobile-action-btn" onClick={goToSidebar}>
          Painel
        </button>
        <button
          className="mobile-action-btn mobile-action-primary"
          onClick={handlePrimaryMobileAction}
          disabled={canNavigateNow ? false : (items.length === 0 || status !== 'idle')}
        >
          {canNavigateNow ? <Navigation size={18} /> : <Play size={18} />}
          {canNavigateNow ? 'Navegar' : 'Otimizar'}
        </button>
        <button className="mobile-action-btn" onClick={goToMap}>
          Mapa
        </button>
      </div>

      {isFieldMode && status === 'ready' && (
        <div className="field-mode-overlay">
          <div className="field-mode-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 900 }}>Modo motorista</h3>
              <button className="btn btn-outline" onClick={() => setIsFieldMode(false)}>Sair</button>
            </div>
            <p style={{ marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {progressDone}/{progressTotal} entregas concluídas
            </p>
            {currentStop ? (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Próxima parada</p>
                <p style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '0.25rem' }}>{currentStop.address}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem', marginTop: '1rem' }}>
                  <button className="btn btn-primary" style={{ minHeight: '58px', fontSize: '1.05rem' }} onClick={openCurrentStopNavigation}>
                    <Navigation size={20} /> Abrir navegação
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    <button className="btn btn-primary" style={{ minHeight: '58px', fontSize: '1rem' }} onClick={() => markStopStatus(nextPendingIndex, 'done')}>Concluir</button>
                    <button className="btn btn-outline" style={{ minHeight: '58px', fontSize: '1rem' }} onClick={() => markStopStatus(nextPendingIndex, 'failed')}>Falha</button>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ marginTop: '1rem', color: 'var(--success)', fontWeight: 800 }}>Rota concluída.</p>
            )}
            <p style={{ marginTop: '1rem', color: isOnline ? 'var(--success)' : 'var(--error)', fontWeight: 700, fontSize: '0.9rem' }}>
              {isOnline ? 'Conectado' : 'Sem conexão: mudanças ficam salvas no aparelho'}
            </p>
          </div>
        </div>
      )}

      {toast && (
        <div className={`app-toast app-toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
