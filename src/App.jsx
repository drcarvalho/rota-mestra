import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  Play, RefreshCw, Navigation, Zap, Map as MapIcon,
  Truck, LayoutGrid, Settings as SettingsIcon,
  Sun, Moon
} from 'lucide-react';

import { parseFile } from './utils/fileParser';
import { geocodeBatch } from './utils/geocoding';
import { optimizeRoute } from './utils/optimizer';

import FileUploader from './components/FileUploader';
import RouteDetails from './components/RouteDetails';
import Button from './components/ui/Button';
import HistoryPanel from './components/app/HistoryPanel';
import SettingsPanel from './components/app/SettingsPanel';
import { useWorkspacePersistence, useRouteHistory } from './hooks/useRoutePersistence';
import confetti from 'canvas-confetti';
import './App.css';

const MapView = lazy(() => import('./components/MapView'));

const WORKSPACE_KEY = 'rota_mestra_v4_elite';
const HISTORY_KEY = 'rota_mestra_v4_history';
const ACTION_QUEUE_KEY = 'rota_mestra_action_queue_v1';
const hasValidCoords = (item) => Boolean(item?.coords && Number.isFinite(item.coords.lat) && Number.isFinite(item.coords.lon));
const buildInitialStopStatuses = (routeItems) => routeItems.reduce((acc, item, idx) => {
  acc[String(item.id)] = idx === 0 ? 'done' : 'pending';
  return acc;
}, {});

function App() {
  const fuelPrice = 5.8;
  const autonomy = 12;
  const initialTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') || 'light' : 'light';
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(initialTheme === 'dark');
  const [roundTrip, setRoundTrip] = useState(false);
  const [startPointId, setStartPointId] = useState(null);
  const [optimizeBy, setOptimizeBy] = useState('distance');
  const [stopStatuses, setStopStatuses] = useState({});
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [mobileView, setMobileView] = useState('panel'); // panel, map
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('optimizer');
  const [showRouteSummary, setShowRouteSummary] = useState(false);
  const [pendingActions, setPendingActions] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(ACTION_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const { routeHistory, persistHistory } = useRouteHistory(HISTORY_KEY);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const resizer = () => setIsMobile(window.innerWidth <= 1024);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('resize', resizer);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('resize', resizer);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(pendingActions));
  }, [pendingActions]);

  useEffect(() => {
    if (!isOnline || pendingActions.length === 0) return;
    setPendingActions([]);
    showToast('Ações offline sincronizadas.', 'success');
  }, [isOnline, pendingActions.length]);

  useWorkspacePersistence({
    storageKey: WORKSPACE_KEY,
    items, routeInfo, roundTrip, startPointId, optimizeBy, stopStatuses, status,
    setItems, setRouteInfo, setRoundTrip, setStartPointId, setOptimizeBy, setStopStatuses, setStatus
  });

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (message, type = 'info') => setToast({ message, type });

  const resetWorkspace = () => {
    if (!window.confirm('Deseja limpar a sessão atual?')) return;
    setItems([]);
    setStatus('idle');
    setProgress(0);
    setRouteInfo(null);
    setRoundTrip(false);
    setStartPointId(null);
    setOptimizeBy('distance');
    setStopStatuses({});
    setPendingActions([]);
    setShowRouteSummary(false);
    setMobileView('panel');
    localStorage.removeItem(WORKSPACE_KEY);
    localStorage.removeItem(ACTION_QUEUE_KEY);
    showToast('Sessão reiniciada.', 'info');
  };

  const toggleTheme = () => {
    const nextTheme = !isDarkMode ? 'dark' : 'light';
    setIsDarkMode(!isDarkMode);
    localStorage.setItem('theme', nextTheme);
  };

  const handleUpload = async (file) => {
    try {
      setStatus('uploading');
      const data = await parseFile(file);
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Arquivo sem dados válidos.');
      }
      setItems(data);
      setStartPointId(data[0]?.id ?? null);
      setStopStatuses({});
      setShowRouteSummary(false);
      setStatus('idle');
      showToast('Dados consolidados!', 'success');
    } catch (err) { showToast(err.message, 'error'); setStatus('idle'); }
  };

  const startOptimization = async () => {
    if (!items.length) return;
    setProgress(0);
    setStatus('geocoding');
    let optimizeProgressTimer = null;
    try {
      const geo = await geocodeBatch(items, (c, t) => {
        // Phase 1: geocoding fills 0-80%
        const geocodeProgress = Math.round((c / t) * 80);
        setProgress(Math.max(0, Math.min(80, geocodeProgress)));
      });
      const validItems = geo.filter((item) => item.status === 'success' && hasValidCoords(item));
      if (!validItems.length) {
        throw new Error('Nenhum endereço válido foi localizado.');
      }

      setStatus('optimizing');
      setProgress((prev) => Math.max(prev, 82));
      // Phase 2: while optimizer runs, show continuous progress 82-97%
      optimizeProgressTimer = setInterval(() => {
        setProgress((prev) => (prev < 97 ? prev + 1 : prev));
      }, 120);
      const sIdx = validItems.findIndex(i => String(i.id) === String(startPointId));
      const res = await optimizeRoute(validItems, { roundTrip, startIndex: sIdx >= 0 ? sIdx : 0, optimizeBy });
      setProgress(100);
      setItems(res.orderedItems);
      setRouteInfo(res);
      setStopStatuses(buildInitialStopStatuses(res.orderedItems));
      setShowRouteSummary(false);
      setStatus('ready');
      if (isMobile) setMobileView('panel');
      confetti({ particleCount: 200, spread: 70, origin: { y: 0.7 } });
    } catch (err) {
      showToast(err.message, 'error');
      setStatus('idle');
    } finally {
      if (optimizeProgressTimer) clearInterval(optimizeProgressTimer);
    }
  };

  const markStatus = (idx, s) => {
    if (!items[idx]) return;
    const stopId = String(items[idx].id);
    setStopStatuses(prev => ({ ...prev, [stopId]: s }));
    if (!isOnline) {
      setPendingActions((current) => ([
        ...current,
        { stopId, status: s, timestamp: Date.now() }
      ]));
      showToast('Sem internet. Ação salva e será sincronizada quando voltar conexão.', 'info');
      return;
    }
    showToast(
      s === 'done' ? 'Entrega marcada como concluída.' : 'Entrega marcada como não entregue.',
      s === 'done' ? 'success' : 'error'
    );
  };

  const currentIdx = items.findIndex((it, i) => i > 0 && stopStatuses[String(it.id)] !== 'done');
  const currentItem = currentIdx > 0 ? items[currentIdx] : null;
  const baselineKm = routeInfo?.baseline?.distance ? routeInfo.baseline.distance / 1000 : null;
  const optimizedKm = routeInfo?.distance ? routeInfo.distance / 1000 : null;
  const baselineMin = routeInfo?.baseline?.duration ? Math.round(routeInfo.baseline.duration / 60) : null;
  const optimizedMin = routeInfo?.duration ? Math.round(routeInfo.duration / 60) : null;
  const savedKm = baselineKm !== null && optimizedKm !== null ? Math.max(0, baselineKm - optimizedKm) : null;
  const savedMin = baselineMin !== null && optimizedMin !== null ? Math.max(0, baselineMin - optimizedMin) : null;
  const estimatedFuelCost = optimizedKm !== null ? (optimizedKm / autonomy) * fuelPrice : null;
  const openCurrentNavigation = () => {
    if (!currentItem?.coords) return;
    window.open(`https://waze.com/ul?ll=${currentItem.coords.lat},${currentItem.coords.lon}&navigate=yes`, '_blank', 'noopener,noreferrer');
  };
  const saveCurrentRoute = () => {
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
    persistHistory([entry, ...routeHistory].slice(0, 30));
    showToast('Rota salva no histórico.', 'success');
  };

  return (
    <div className="app-shell">
      <header className="top-glass">
        <div className="brand-elite">
          <div className="brand-icon-box"><Truck size={20} /></div>
          <span className="brand-text">RotaMestra Pro</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isMobile && (
            <Button variant="o" style={{ width: '42px', padding: 0, borderRadius: '12px' }} onClick={toggleTheme}>
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          )}
          {!isMobile && items.length > 0 && (
            <Button variant="o" style={{ borderRadius: '12px' }} onClick={resetWorkspace}>
              Nova rota
            </Button>
          )}
        </div>
      </header>

      <main className="main-viewport">
        {/* SIDE PANEL (Panel view on mobile) */}
        <aside className={`side-panel ${isMobile && mobileView === 'map' ? 'hidden' : ''}`}>
          <div className="bento-scroll">
            <>
              {activeTab === 'optimizer' && (
                <div key="opt">

                  {/* Empty State / Hero */}
                  {status === 'idle' && items.length === 0 && (
                    <div className="animate-slide-up" style={{ padding: '2rem 0', textAlign: 'center' }}>
                      <div style={{ marginBottom: '1.5rem', display: 'inline-flex', padding: '8px 16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem' }}>
                        Planejamento de entregas
                      </div>
                      <h1 style={{ fontSize: '2.4rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1rem' }}>Otimize suas entregas</h1>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Importe sua planilha e calcule a melhor rota.</p>
                      <FileUploader onUpload={handleUpload} onValidationError={m => showToast(m, 'error')} />
                    </div>
                  )}

                  {/* Processing Status */}
                  {(status === 'geocoding' || status === 'optimizing' || status === 'uploading') && (
                    <div className="bento-card text-center">
                      <div className="loading-spinner" style={{ margin: '0 auto 1rem', width: '44px', height: '44px' }} />
                      <h3 style={{ fontWeight: 800 }}>Processando dados da rota</h3>
                      <div className="progress-bar-track" style={{ height: '10px', marginTop: '1.5rem' }}>
                        <div className="progress-bar-fill" style={{ width: `${progress}%`, borderRadius: '10px' }} />
                      </div>
                      <p style={{ marginTop: '0.75rem', fontWeight: 800, color: 'var(--primary)' }}>{progress}%</p>
                    </div>
                  )}

                  {/* Pre-Calculation Bento Config */}
                  {status === 'idle' && items.length > 0 && (
                    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="bento-card">
                        <h3 style={{ fontWeight: 800, marginBottom: '1.25rem' }}>Configuração da rota</h3>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                          <div className="config-option">
                            <span className="config-label">Objetivo da rota</span>
                            <select value={optimizeBy} onChange={e => setOptimizeBy(e.target.value)}>
                              <option value="distance">Menor distância</option>
                              <option value="duration">Menor tempo</option>
                            </select>
                          </div>
                          <div className="config-option">
                            <span className="config-label">Ponto de partida</span>
                            <select value={startPointId ?? ''} onChange={e => setStartPointId(e.target.value)}>
                              {items.map((it, i) => <option key={it.id} value={it.id}>{i + 1}. {it.address}</option>)}
                            </select>
                          </div>
                          <Button variant="p" fullWidth size="lg" onClick={startOptimization}>
                            <Zap size={20} fill="white" /> Calcular rota
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ready State - Dasboard Bento */}
                  {status === 'ready' && routeInfo && (
                    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {currentItem && (
                        <div className="bento-card">
                          <p className="config-label">Próxima parada</p>
                          <p style={{ fontWeight: 800, marginTop: '0.3rem' }}>{currentItem.address}</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.6rem', marginTop: '0.8rem' }}>
                            <Button variant="primary" onClick={openCurrentNavigation}>
                              <Navigation size={16} /> Navegar agora
                            </Button>
                            <Button variant="outline" onClick={() => markStatus(currentIdx, 'done')}>
                              Marcar entregue
                            </Button>
                          </div>
                        </div>
                      )}

                      <RouteDetails
                        items={items}
                        stopStatuses={stopStatuses}
                        onMarkDone={idx => markStatus(idx, 'done')}
                        onMarkFailed={idx => markStatus(idx, 'failed')}
                        onCopyAddress={async (address) => {
                          try {
                            await navigator.clipboard?.writeText(address || '');
                            showToast('Endereço copiado.', 'success');
                          } catch {
                            showToast('Não foi possível copiar.', 'error');
                          }
                        }}
                      />

                      <Button variant="o" fullWidth onClick={() => setStatus('idle')}>
                        <RefreshCw size={16} /> Recalcular rota
                      </Button>
                      <Button variant="outline" fullWidth onClick={saveCurrentRoute}>
                        Salvar no histórico
                      </Button>
                      <Button variant="outline" fullWidth onClick={() => setShowRouteSummary((v) => !v)}>
                        {showRouteSummary ? 'Ocultar resumo' : 'Ver resumo da rota'}
                      </Button>
                      {showRouteSummary && (
                        <div className="bento-card" style={{ padding: '0.9rem' }}>
                          <p className="config-label">Resumo da rota</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.5rem' }}>
                            <div>
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Distância total</p>
                              <p style={{ fontWeight: 800 }}>{optimizedKm !== null ? `${optimizedKm.toFixed(1)} km` : '--'}</p>
                            </div>
                            <div>
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>Combustível (estimado)</p>
                              <p style={{ fontWeight: 800 }}>{estimatedFuelCost !== null ? `R$ ${estimatedFuelCost.toFixed(2)}` : '--'}</p>
                            </div>
                          </div>
                          {baselineKm !== null && baselineMin !== null && optimizedMin !== null && (
                            <div style={{ marginTop: '0.55rem' }}>
                              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Comparação: antes <b>{baselineKm.toFixed(1)} km / {baselineMin} min</b> · agora <b>{optimizedKm?.toFixed(1)} km / {optimizedMin} min</b>
                              </p>
                              <p style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 700, marginTop: '0.2rem' }}>
                                Economia: {savedKm !== null ? `${savedKm.toFixed(1)} km` : '--'} e {savedMin !== null ? `${savedMin} min` : '--'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div key="hist">
                  <HistoryPanel routeHistory={routeHistory} onClear={() => persistHistory([])} onLoad={(l) => {
                    setItems(l.items || []);
                    setRouteInfo(l.routeInfo || null);
                    setRoundTrip(Boolean(l.roundTrip));
                    setOptimizeBy(l.optimizeBy === 'duration' ? 'duration' : 'distance');
                    setStartPointId(l.startPointId ?? l.items?.[0]?.id ?? null);
                    setStopStatuses(buildInitialStopStatuses(l.items || []));
                    setStatus(l.routeInfo ? 'ready' : 'idle');
                    setMobileView('panel');
                    setActiveTab('optimizer');
                  }} />
                </div>
              )}

              {activeTab === 'settings' && (
                <div key="set">
                  <SettingsPanel
                    onClearWorkspace={resetWorkspace}
                    onClearHistory={() => persistHistory([])}
                    onOpenHistory={() => setActiveTab('history')}
                    onBackToOptimizer={() => setActiveTab('optimizer')}
                    onToggleTheme={toggleTheme}
                    isDarkMode={isDarkMode}
                  />
                </div>
              )}
            </>
          </div>
        </aside>

        {/* MAP VIEWPORT */}
        <div className="map-viewport">
          <Suspense fallback={<div className="loading-spinner"></div>}>
            <MapView items={items} routeGeometry={routeInfo?.geometry} stopStatuses={stopStatuses} nextStopIndex={currentIdx} isVisible={!(isMobile && mobileView === 'panel')} />
          </Suspense>

          {/* Floating Mobile Map HUD */}
          {isMobile && mobileView === 'map' && status === 'ready' && currentItem && (
            <div className="hud-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div className="status-glow" style={{ background: 'var(--primary)' }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>PRÓXIMA ENTREGA</span>
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.25rem' }}>{currentItem.address}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '0.75rem' }}>
                <button className="btn-elite btn-p" onClick={openCurrentNavigation}>
                  <Navigation size={18} fill="white" /> NAVEGAR AGORA
                </button>
                <button className="btn-elite btn-o" onClick={() => markStatus(currentIdx, 'done')}>
                  CONCLUIR
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MOBILE CRYSTAL NAVIGATION PILL */}
      {isMobile && (
        <nav className="mobile-nav-pill">
          <button
            className={`nav-item ${mobileView === 'panel' && activeTab === 'optimizer' ? 'active' : ''}`}
            onClick={() => { setMobileView('panel'); setActiveTab('optimizer'); }}
          >
            <LayoutGrid size={18} />
            Painel
          </button>
          <button
            className={`nav-item ${mobileView === 'map' ? 'active' : ''}`}
            onClick={() => setMobileView('map')}
          >
            <MapIcon size={18} />
            Mapa
          </button>

          <button
            className="nav-action-center"
            onClick={() => (currentItem ? openCurrentNavigation() : startOptimization())}
            disabled={!currentItem && status !== 'idle'}
          >
            {status === 'ready' ? <Navigation size={20} fill="white" /> : <Play size={20} fill="white" />}
            {status === 'ready' ? 'Navegar' : 'Otimizar'}
          </button>

          <button
            className={`nav-item ${mobileView === 'panel' && activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setMobileView('panel'); setActiveTab('settings'); }}
          >
            <SettingsIcon size={18} />
            Configurações
          </button>
        </nav>
      )}

      {/* REFINED TOAST */}
      {toast && (
        <div className={`app-toast app-toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
      {isMobile && pendingActions.length > 0 && (
        <div className="app-toast app-toast-info" style={{ bottom: '146px' }}>
          {pendingActions.length} ação(ões) aguardando internet
        </div>
      )}
    </div>
  );
}

export default App;
