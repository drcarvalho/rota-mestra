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
  const [routeProfile, setRouteProfile] = useState('neutral');
  const [stopStatuses, setStopStatuses] = useState({});
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [mobileView, setMobileView] = useState('panel'); // panel, map
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('optimizer');
  const [showRouteSummary, setShowRouteSummary] = useState(false);
  const [operationMode, setOperationMode] = useState(false);
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
    storageKey: WORKSPACE_KEY, items, routeInfo, roundTrip, startPointId, optimizeBy, routeProfile, stopStatuses, status,
    setItems, setRouteInfo, setRoundTrip, setStartPointId, setOptimizeBy, setRouteProfile, setStopStatuses, setStatus
  });

  useEffect(() => {
    if (!operationMode) return;
    if (status !== 'ready') {
      setOperationMode(false);
      return;
    }
    setMobileView('map');
  }, [operationMode, status]);

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
    setRouteProfile('neutral');
    setStopStatuses({});
    setPendingActions([]);
    setShowRouteSummary(false);
    setOperationMode(false);
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
      setProgress(0);
      const data = await parseFile(file);
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Arquivo sem dados válidos.');
      }
      setItems(data);
      setStartPointId(data[0]?.id ?? null);
      setStopStatuses({});
      setShowRouteSummary(false);
      setOperationMode(false);
      setActiveTab('optimizer');
      setMobileView('panel');
      setStatus('idle');
      showToast('Dados consolidados!', 'success');
    } catch (err) { showToast(err.message, 'error'); setStatus('idle'); }
  };

  const startOptimization = async () => {
    if (!items.length) return;
    if (status === 'geocoding' || status === 'optimizing' || status === 'uploading') return;
    setProgress(0);
    setStatus('geocoding');
    let optimizeProgressTimer = null;
    try {
      const geo = await geocodeBatch(items, (c, t) => {
        // Phase 1: geocoding fills 0-80%
        const geocodeProgress = t > 0 ? Math.round((c / t) * 80) : 0;
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
      const res = await optimizeRoute(validItems, {
        roundTrip,
        startIndex: sIdx >= 0 ? sIdx : 0,
        optimizeBy,
        routeProfile
      });
      setProgress(100);
      setItems(res.orderedItems);
      setRouteInfo(res);
      setStopStatuses(buildInitialStopStatuses(res.orderedItems));
      setShowRouteSummary(false);
      setOperationMode(false);
      setStatus('ready');
      if (isMobile) setMobileView('panel');
      const optimizedDistanceKm = Number.isFinite(res?.distance) ? res.distance / 1000 : null;
      const optimizedDurationMin = Number.isFinite(res?.duration) ? Math.round(res.duration / 60) : null;
      if (optimizedDistanceKm !== null && optimizedDurationMin !== null) {
        showToast(`Rota pronta: ${optimizedDistanceKm.toFixed(1)} km · ${optimizedDurationMin} min`, 'success');
      }
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
  const deliveryStats = items.reduce((acc, item, idx) => {
    if (idx === 0) return acc;
    acc.total += 1;
    const statusValue = stopStatuses[String(item.id)] || 'pending';
    if (statusValue === 'done') acc.done += 1;
    else if (statusValue === 'failed') acc.failed += 1;
    else acc.pending += 1;
    return acc;
  }, { total: 0, done: 0, failed: 0, pending: 0 });
  const deliveryProgressPercent = deliveryStats.total > 0
    ? Math.round((deliveryStats.done / deliveryStats.total) * 100)
    : 0;
  const baselineKm = routeInfo?.baseline?.distance ? routeInfo.baseline.distance / 1000 : null;
  const optimizedKm = routeInfo?.distance ? routeInfo.distance / 1000 : null;
  const baselineMin = routeInfo?.baseline?.duration ? Math.round(routeInfo.baseline.duration / 60) : null;
  const optimizedMin = routeInfo?.duration ? Math.round(routeInfo.duration / 60) : null;
  const savedKm = baselineKm !== null && optimizedKm !== null ? Math.max(0, baselineKm - optimizedKm) : null;
  const savedMin = baselineMin !== null && optimizedMin !== null ? Math.max(0, baselineMin - optimizedMin) : null;
  const estimatedFuelCost = optimizedKm !== null ? (optimizedKm / autonomy) * fuelPrice : null;
  const routeObjectiveLabel = optimizeBy === 'duration' ? 'Menor tempo' : 'Menor distância';
  const routeProfileLabel = routeProfile === 'mercado_livre'
    ? 'Mercado Livre'
    : routeProfile === 'shopee'
      ? 'Shopee'
      : 'Padrão';
  const routeQuality = (() => {
    if (baselineKm === null || optimizedKm === null || baselineKm <= 0) return null;
    const reductionPercent = ((baselineKm - optimizedKm) / baselineKm) * 100;
    if (reductionPercent >= 20) return { label: 'Excelente', tone: 'success' };
    if (reductionPercent >= 10) return { label: 'Muito boa', tone: 'info' };
    if (reductionPercent >= 3) return { label: 'Boa', tone: 'warning' };
    return { label: 'Sem ganho relevante', tone: 'neutral' };
  })();
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
      routeProfile,
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
                      <h1 style={{ fontSize: '2.05rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '0.8rem' }}>Roteirizador de entregas</h1>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '1.4rem' }}>Importe sua planilha e calcule a melhor sequência.</p>
                      <FileUploader onUpload={handleUpload} onValidationError={m => showToast(m, 'error')} />
                    </div>
                  )}

                  {/* Processing Status */}
                  {(status === 'geocoding' || status === 'optimizing' || status === 'uploading') && (
                    <div className="bento-card text-center">
                      <div className="loading-spinner" style={{ margin: '0 auto 1rem', width: '44px', height: '44px' }} />
                      <h3 style={{ fontWeight: 800 }}>Calculando rota</h3>
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
                        <h3 style={{ fontWeight: 800, marginBottom: '0.85rem' }}>Configuração da rota</h3>
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
                          <div className="config-option">
                            <span className="config-label">Perfil da operação</span>
                            <select value={routeProfile} onChange={e => setRouteProfile(e.target.value)}>
                              <option value="neutral">Padrão</option>
                              <option value="shopee">Shopee</option>
                              <option value="mercado_livre">Mercado Livre</option>
                            </select>
                          </div>
                          <Button variant="p" fullWidth size="lg" onClick={startOptimization}>
                            <Zap size={20} fill="white" /> Calcular rota
                          </Button>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                            A rota será calculada por {optimizeBy === 'duration' ? 'tempo total' : 'distância total'}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ready State - Dasboard Bento */}
                  {status === 'ready' && routeInfo && (
                    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="bento-card" style={{ padding: '0.85rem 0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.45rem' }}>
                          <p className="config-label">Visão rápida</p>
                          <p style={{ fontSize: '0.8rem', fontWeight: 800 }}>{deliveryProgressPercent}% concluído</p>
                        </div>
                        <div className="progress-bar-track" style={{ height: '8px' }}>
                          <div className="progress-bar-fill" style={{ width: `${deliveryProgressPercent}%`, borderRadius: '8px' }} />
                        </div>
                        <div className="quick-overview-grid">
                          <span>Objetivo: <b>{routeObjectiveLabel}</b></span>
                          <span>Perfil: <b>{routeProfileLabel}</b></span>
                          <span>Entregues: <b>{deliveryStats.done}</b></span>
                          <span>Pendentes: <b>{deliveryStats.pending}</b></span>
                        </div>
                      </div>

                      {!currentItem && (
                        <div className="bento-card">
                          <p style={{ fontWeight: 800 }}>Rota concluída</p>
                          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Todas as paradas foram marcadas como entregues.
                          </p>
                        </div>
                      )}

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

                      <div className="secondary-actions-row">
                        <Button variant="o" size="sm" fullWidth onClick={() => setStatus('idle')}>
                          <RefreshCw size={15} /> Recalcular
                        </Button>
                        <Button variant="outline" size="sm" fullWidth onClick={saveCurrentRoute}>
                          Salvar
                        </Button>
                      </div>
                      {isMobile && (
                        <Button variant="primary" fullWidth onClick={() => { setOperationMode(true); setMobileView('map'); }}>
                          <Navigation size={16} /> Modo operação
                        </Button>
                      )}
                      <Button variant="outline" size="sm" fullWidth onClick={() => setShowRouteSummary((v) => !v)}>
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
                              {routeQuality && (
                                <p style={{ fontSize: '0.72rem', color: routeQuality.tone === 'success' ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700, marginTop: '0.2rem' }}>
                                  Qualidade da otimização: {routeQuality.label}
                                </p>
                              )}
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
                    setRouteProfile(l.routeProfile === 'shopee' || l.routeProfile === 'mercado_livre' ? l.routeProfile : 'neutral');
                    setStartPointId(l.startPointId ?? l.items?.[0]?.id ?? null);
                    setStopStatuses(buildInitialStopStatuses(l.items || []));
                    setStatus(l.routeInfo ? 'ready' : 'idle');
                    setOperationMode(false);
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
          {isMobile && !operationMode && mobileView === 'map' && status === 'ready' && currentItem && (
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

          {isMobile && operationMode && status === 'ready' && (
            <div className="operation-mode-overlay">
              <div className="operation-mode-head">
                <span>Modo operação</span>
                <button type="button" className="operation-close-btn" onClick={() => setOperationMode(false)}>
                  Sair
                </button>
              </div>
              {currentItem ? (
                <>
                  <p className="operation-label">Próxima parada</p>
                  <h2 className="operation-address">{currentItem.address}</h2>
                  <button type="button" className="operation-btn operation-btn-primary" onClick={openCurrentNavigation}>
                    <Navigation size={18} /> Navegar
                  </button>
                  <div className="operation-actions-grid">
                    <button type="button" className="operation-btn operation-btn-success" onClick={() => markStatus(currentIdx, 'done')}>
                      Entregue
                    </button>
                    <button type="button" className="operation-btn operation-btn-danger" onClick={() => markStatus(currentIdx, 'failed')}>
                      Falhou
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="operation-label">Rota finalizada</p>
                  <h2 className="operation-address">Todas as paradas foram concluídas.</h2>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MOBILE CRYSTAL NAVIGATION PILL */}
      {isMobile && !operationMode && (
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
            {status === 'ready' ? 'Ir p/ próxima' : 'Calcular rota'}
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
