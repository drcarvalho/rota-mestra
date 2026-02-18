import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import {
  Play, RefreshCw, Navigation, Zap, Map as MapIcon,
  Truck, LayoutGrid, Settings as SettingsIcon, History,
  Sun, Moon
} from 'lucide-react';

import { parseFile } from './utils/fileParser';
import { geocodeBatch } from './utils/geocoding';
import { optimizeRoute } from './utils/optimizer';
import { buildStopGroups } from './utils/stopGrouping';

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
const DRIVER_DETAIL_KEY = 'rota_mestra_driver_detail_mode_v1';
const PANEL_TABS = [
  { key: 'optimizer', label: 'Início', Icon: LayoutGrid },
  { key: 'history', label: 'Histórico', Icon: History },
  { key: 'settings', label: 'Configurações', Icon: SettingsIcon }
];
const hasValidCoords = (item) => Boolean(item?.coords && Number.isFinite(item.coords.lat) && Number.isFinite(item.coords.lon));
const isStopResolved = (statusValue) => statusValue === 'done' || statusValue === 'failed';
const buildInitialStopStatuses = (routeItems) => routeItems.reduce((acc, item, idx) => {
  acc[String(item.id)] = idx === 0 ? 'done' : 'pending';
  return acc;
}, {});
const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
const normalizeAddressKey = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');
const distanceKm = (c1, c2) => {
  if (!c1 || !c2) return Infinity;
  const R = 6371;
  const dLat = (c2.lat - c1.lat) * Math.PI / 180;
  const dLon = (c2.lon - c1.lon) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(c1.lat * Math.PI / 180) * Math.cos(c2.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const cleanOptimizationItems = (routeItems) => {
  if (!Array.isArray(routeItems) || routeItems.length <= 2) return { items: routeItems || [], removedDuplicates: 0, removedOutliers: 0 };

  const uniqueMap = new Map();
  routeItems.forEach((item, idx) => {
    const lat = Number(item?.coords?.lat);
    const lon = Number(item?.coords?.lon);
    const coordsKey = Number.isFinite(lat) && Number.isFinite(lon) ? `${lat.toFixed(5)}:${lon.toFixed(5)}` : 'noc';
    const key = `${normalizeAddressKey(item?.address)}|${coordsKey}`;
    if (!uniqueMap.has(key) || idx === 0) uniqueMap.set(key, item);
  });
  const deduped = [routeItems[0], ...Array.from(uniqueMap.values()).filter((item) => String(item.id) !== String(routeItems[0].id))];
  const removedDuplicates = Math.max(0, routeItems.length - deduped.length);

  const latList = deduped.slice(1).map((item) => Number(item?.coords?.lat)).filter(Number.isFinite);
  const lonList = deduped.slice(1).map((item) => Number(item?.coords?.lon)).filter(Number.isFinite);
  if (latList.length < 3 || lonList.length < 3) return { items: deduped, removedDuplicates, removedOutliers: 0 };
  const center = {
    lat: latList.reduce((acc, value) => acc + value, 0) / latList.length,
    lon: lonList.reduce((acc, value) => acc + value, 0) / lonList.length
  };
  const dists = deduped.slice(1).map((item) => distanceKm(center, item.coords)).filter(Number.isFinite).sort((a, b) => a - b);
  const p90 = dists[Math.floor(dists.length * 0.9)] || 0;
  const maxAllowed = Math.max(45, p90 * 3);
  const filtered = [deduped[0], ...deduped.slice(1).filter((item) => distanceKm(center, item.coords) <= maxAllowed)];
  const removedOutliers = Math.max(0, deduped.length - filtered.length);
  if (filtered.length < 3) return { items: deduped, removedDuplicates, removedOutliers: 0 };
  return { items: filtered, removedDuplicates, removedOutliers };
};

function App() {
  const fuelPrice = 5.8;
  const autonomy = 12;
  const initialTheme = (() => {
    if (typeof window === 'undefined') return 'light';
    try {
      return localStorage.getItem('theme') || 'light';
    } catch {
      return 'light';
    }
  })();
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
  const [showStopList, setShowStopList] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [deliveryCountMode, setDeliveryCountMode] = useState('stops');
  const [operationMode, setOperationMode] = useState(false);
  const [autoReoptimize, setAutoReoptimize] = useState(true);
  const [driverDetailMode, setDriverDetailMode] = useState(() => {
    if (typeof window === 'undefined') return 'detailed';
    try {
      const saved = localStorage.getItem(DRIVER_DETAIL_KEY);
      return saved === 'compact' ? 'compact' : 'detailed';
    } catch {
      return 'detailed';
    }
  });
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    return Boolean(window.navigator.standalone);
  });
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
    try {
      localStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(pendingActions));
    } catch {
      // noop
    }
  }, [pendingActions]);

  useEffect(() => {
    if (!isOnline || pendingActions.length === 0) return;
    setPendingActions([]);
    showToast('Ações sem internet enviadas.', 'success');
  }, [isOnline, pendingActions.length]);

  useWorkspacePersistence({
    storageKey: WORKSPACE_KEY, items, routeInfo, roundTrip, startPointId, optimizeBy, routeProfile, stopStatuses, status, deliveryCountMode,
    setItems, setRouteInfo, setRoundTrip, setStartPointId, setOptimizeBy, setRouteProfile, setStopStatuses, setStatus, setDeliveryCountMode
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

  useEffect(() => {
    try {
      localStorage.setItem(DRIVER_DETAIL_KEY, driverDetailMode);
    } catch {
      // noop
    }
  }, [driverDetailMode]);

  const showToast = (message, type = 'info') => setToast({ message, type });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPromptEvent(event);
    };

    const onAppInstalled = () => {
      setIsAppInstalled(true);
      setInstallPromptEvent(null);
      setToast({ message: 'App instalado com sucesso.', type: 'success' });
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (e) => {
      if (e.matches) {
        setIsAppInstalled(true);
        setInstallPromptEvent(null);
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', onDisplayModeChange);
    } else {
      mediaQuery.addListener(onDisplayModeChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', onDisplayModeChange);
      } else {
        mediaQuery.removeListener(onDisplayModeChange);
      }
    };
  }, []);

  const handleInstallApp = async () => {
    if (isAppInstalled) {
      showToast('Este app já está instalado.', 'info');
      return;
    }

    if (installPromptEvent) {
      installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      setInstallPromptEvent(null);
      if (choice?.outcome === 'accepted') {
        showToast('Instalação iniciada.', 'success');
      } else {
        showToast('Instalação cancelada.', 'info');
      }
      return;
    }

    const ua = String(window.navigator.userAgent || '').toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    if (isIos) {
      showToast('No Safari: Compartilhar -> Adicionar à Tela de Início.', 'info');
      return;
    }
    showToast('No Chrome/Edge: menu do navegador -> Instalar app.', 'info');
  };

  const resetWorkspace = () => {
    if (!window.confirm('Começar nova rota? Isso limpa a rota atual.')) return;
    setItems([]);
    setStatus('idle');
    setProgress(0);
    setRouteInfo(null);
    setRoundTrip(false);
    setStartPointId(null);
    setOptimizeBy('distance');
    setRouteProfile('neutral');
    setDeliveryCountMode('stops');
    setStopStatuses({});
    setPendingActions([]);
    setShowRouteSummary(false);
    setShowStopList(false);
    setShowMoreTools(false);
    setShowAdvancedConfig(false);
    setOperationMode(false);
    setMobileView('panel');
    try {
      localStorage.removeItem(WORKSPACE_KEY);
      localStorage.removeItem(ACTION_QUEUE_KEY);
    } catch {
      // noop
    }
    showToast('Rota limpa.', 'info');
  };

  const toggleTheme = () => {
    const nextTheme = !isDarkMode ? 'dark' : 'light';
    setIsDarkMode(!isDarkMode);
    try {
      localStorage.setItem('theme', nextTheme);
    } catch {
      // noop
    }
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
      setStartPointId(null);
      setStopStatuses({});
      setShowRouteSummary(false);
      setShowStopList(false);
      setShowMoreTools(false);
      setShowAdvancedConfig(false);
      setOperationMode(false);
      setActiveTab('optimizer');
      setMobileView('panel');
      setStatus('idle');
      showToast('Planilha carregada.', 'success');
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
      const validItemsRaw = geo.filter((item) => item.status === 'success' && hasValidCoords(item));
      if (!validItemsRaw.length) {
        throw new Error('Não foi possível localizar os endereços da planilha.');
      }
      const cleaned = cleanOptimizationItems(validItemsRaw);
      const validItems = cleaned.items;
      if (cleaned.removedDuplicates > 0) showToast(`${cleaned.removedDuplicates} duplicidade(s) removida(s).`, 'info');
      if (cleaned.removedOutliers > 0) showToast(`${cleaned.removedOutliers} ponto(s) distante(s) removido(s) por consistência.`, 'info');
      if (validItems.length < 2) throw new Error('Não há pontos suficientes para otimizar após validação.');

      setStatus('optimizing');
      setProgress((prev) => Math.max(prev, 82));
      // Phase 2: while optimizer runs, show continuous progress 82-97%
      optimizeProgressTimer = setInterval(() => {
        setProgress((prev) => (prev < 97 ? prev + 1 : prev));
      }, 120);
      const sIdx = validItems.findIndex(i => String(i.id) === String(startPointId));
      let res;
      let orderedItems;
      if (deliveryCountMode === 'stops') {
        const groups = buildStopGroups(validItems);
        const stopItems = groups.map((group) => {
          const markerItem = group.items.find(hasValidCoords) || group.items[0];
          return {
            ...markerItem,
            id: `stop-${group.key}`,
            label: `Parada ${group.stopOrder}`,
            groupKey: group.key
          };
        });
        const startGroupIndex = groups.findIndex((group) => group.items.some((item) => String(item.id) === String(startPointId)));
        const stopResult = await optimizeRoute(stopItems, {
          roundTrip,
          startIndex: startGroupIndex >= 0 ? startGroupIndex : -1,
          optimizeBy,
          routeProfile
        });
        const groupsByKey = new Map(groups.map((group) => [group.key, group]));
        orderedItems = stopResult.orderedItems.flatMap((stop, stopOrderIdx) => {
          const groupItems = [...(groupsByKey.get(stop.groupKey)?.items || [])];
          if (stopOrderIdx === 0) {
            const preferredStartIdx = groupItems.findIndex((item) => String(item.id) === String(startPointId));
            if (preferredStartIdx > 0) {
              const [preferred] = groupItems.splice(preferredStartIdx, 1);
              groupItems.unshift(preferred);
            }
          }
          return groupItems;
        });
        res = {
          ...stopResult,
          orderedItems
        };
      } else {
        res = await optimizeRoute(validItems, {
          roundTrip,
          startIndex: sIdx >= 0 ? sIdx : -1,
          optimizeBy,
          routeProfile
        });
        orderedItems = res.orderedItems;
      }
      setProgress(100);
      setItems(orderedItems);
      setRouteInfo(res);
      setStopStatuses(buildInitialStopStatuses(orderedItems));
      setShowRouteSummary(false);
      setShowStopList(false);
      setShowMoreTools(false);
      setShowAdvancedConfig(false);
      setOperationMode(false);
      setStatus('ready');
      if (isMobile) setMobileView('panel');
      const optimizedDistanceKm = Number.isFinite(res?.distance) ? res.distance / 1000 : null;
      const optimizedDurationMin = Number.isFinite(res?.duration) ? Math.round(res.duration / 60) : null;
      if (optimizedDistanceKm !== null && optimizedDurationMin !== null) {
        showToast(`Rota otimizada: ${optimizedDistanceKm.toFixed(1)} km · ${optimizedDurationMin} min`, 'success');
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
      showToast('Sem internet. Ação salva para enviar depois.', 'info');
      return;
    }
    const feedbackMessage = s === 'done' ? 'Entrega marcada.' : 'Marcado como não entregue.';
    showToast(feedbackMessage, s === 'done' ? 'success' : 'error');
    if (!autoReoptimize || status !== 'ready' || idx < 1) return;
    const nextStatuses = { ...stopStatuses, [stopId]: s };
    const fixedPart = items.filter((item, itemIdx) => itemIdx <= idx || (nextStatuses[String(item.id)] || 'pending') !== 'pending');
    const pendingTail = items.filter((item, itemIdx) => itemIdx > idx && (nextStatuses[String(item.id)] || 'pending') === 'pending');
    if (pendingTail.length < 2) return;
    setTimeout(async () => {
      try {
        const optimizedTail = await optimizeRoute(pendingTail, {
          roundTrip: false,
          startIndex: 0,
          optimizeBy,
          routeProfile
        });
        const nextItems = [...fixedPart, ...optimizedTail.orderedItems];
        setItems(nextItems);
        setRouteInfo((prev) => ({
          ...prev,
          geometry: null,
          meta: {
            ...(prev?.meta || {}),
            liveReoptimized: true
          }
        }));
      } catch {
        // noop
      }
    }, 100);
  };
  const markStopByItemIds = (itemIds, s) => {
    if (!Array.isArray(itemIds) || itemIds.length === 0) return;
    setStopStatuses((prev) => {
      const next = { ...prev };
      itemIds.forEach((id) => {
        next[String(id)] = s;
      });
      return next;
    });
    if (!isOnline) {
      setPendingActions((current) => ([
        ...current,
        ...itemIds.map((id) => ({ stopId: String(id), status: s, timestamp: Date.now() }))
      ]));
      showToast('Sem internet. Ações da parada salvas para enviar depois.', 'info');
      return;
    }
    showToast(
      s === 'done' ? 'Parada marcada como entregue.' : 'Parada marcada como não entregue.',
      s === 'done' ? 'success' : 'error'
    );
  };

  const currentIdx = items.findIndex((it, i) => i > 0 && !isStopResolved(stopStatuses[String(it.id)]));
  const currentItem = currentIdx > 0 ? items[currentIdx] : null;
  const upcomingStops = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item, idx }) => idx > 0 && (stopStatuses[String(item.id)] || 'pending') === 'pending')
    .slice(0, 4);
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
  const routeQuality = (() => {
    if (baselineKm === null || optimizedKm === null || baselineKm <= 0) return null;
    const reductionPercent = ((baselineKm - optimizedKm) / baselineKm) * 100;
    if (reductionPercent >= 20) return { label: 'Excelente', tone: 'success' };
    if (reductionPercent >= 10) return { label: 'Muito boa', tone: 'info' };
    if (reductionPercent >= 3) return { label: 'Boa', tone: 'warning' };
    return { label: 'Sem ganho relevante', tone: 'neutral' };
  })();
  const openCurrentNavigation = () => {
    if (!currentItem?.coords) {
      showToast('Não há entrega pendente.', 'info');
      return;
    }
    const destination = `${currentItem.coords.lat},${currentItem.coords.lon}`;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
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
      startPointId,
      deliveryCountMode
    };
    persistHistory([entry, ...routeHistory].slice(0, 30));
    showToast('Rota guardada no histórico.', 'success');
  };
  const processingLabel = status === 'uploading'
    ? 'Importando planilha'
    : status === 'geocoding'
      ? 'Geocodificando endereços'
      : 'Calculando melhor rota';
  const packageCount = Math.max(0, items.length - 1);
  const stopGroups = useMemo(() => buildStopGroups(items), [items]);
  const stopCount = stopGroups.length;
  const routeCount = deliveryCountMode === 'stops' ? stopCount : packageCount;
  const routeCountLabel = deliveryCountMode === 'stops'
    ? pluralize(routeCount, 'parada')
    : pluralize(routeCount, 'pacote');
  const stopInfoByItemId = useMemo(() => {
    const map = new Map();
    stopGroups.forEach((group) => {
      const itemIds = group.items.map((item) => String(item.id));
      group.items.forEach((item) => {
        map.set(String(item.id), {
          stopOrder: group.stopOrder,
          packageCount: group.items.length,
          itemIds
        });
      });
    });
    return map;
  }, [stopGroups]);
  const currentStopInfo = currentItem ? stopInfoByItemId.get(String(currentItem.id)) : null;
  const currentStopProgress = useMemo(() => {
    if (!currentStopInfo?.itemIds) return null;
    const total = currentStopInfo.itemIds.length;
    let done = 0;
    let failed = 0;
    currentStopInfo.itemIds.forEach((id) => {
      const statusValue = stopStatuses[String(id)] || 'pending';
      if (statusValue === 'done') done += 1;
      if (statusValue === 'failed') failed += 1;
    });
    const pending = Math.max(0, total - done - failed);
    return { total, done, failed, pending };
  }, [currentStopInfo, stopStatuses]);
  const activeFiltersLabel = `${deliveryCountMode === 'stops' ? 'Paradas' : 'Pacotes'} + ${optimizeBy === 'duration' ? 'Menor tempo' : 'Menor distância'}`;
  const headerStageLabel = status === 'ready'
    ? 'Rota otimizada'
    : status === 'geocoding' || status === 'optimizing' || status === 'uploading'
      ? processingLabel
      : routeCount > 0
        ? 'Pronto para otimizar'
        : 'Novo planejamento';
  const detectedCity = (() => {
    const cityCounter = new Map();
    items.forEach((item) => {
      const parts = String(item?.address || '').split(',').map((p) => p.trim()).filter(Boolean);
      const city = parts.length >= 3 ? parts[parts.length - 3] : null;
      if (!city || city.toLowerCase() === 'brasil') return;
      cityCounter.set(city, (cityCounter.get(city) || 0) + 1);
    });
    let best = null;
    let bestCount = 0;
    cityCounter.forEach((count, city) => {
      if (count > bestCount) {
        best = city;
        bestCount = count;
      }
    });
    return best;
  })();
  const switchToTab = (tabKey) => {
    setActiveTab(tabKey);
    if (isMobile) setMobileView('panel');
  };

  return (
    <div className="app-shell">
      <header className="top-glass">
        <div className="brand-elite">
          <div className="brand-icon-box"><Truck size={20} /></div>
          <div className="brand-copy">
            <span className="brand-text">RotaBoa</span>
            <span className="brand-caption hide-mobile">Operação de entregas</span>
          </div>
        </div>
        <div className="header-kpis hide-mobile">
          <div className="header-pill">
            <span className={`status-dot ${status === 'ready' ? 'status-dot-success' : ''}`} />
            {headerStageLabel}
          </div>
          <div className="header-pill">
            {routeCountLabel}
          </div>
          <div className={`header-pill ${isOnline ? 'header-pill-online' : 'header-pill-offline'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
        <div className="top-glass-actions">
          <Button
            variant={activeTab === 'settings' ? 'primary' : 'outline'}
            className="top-glass-settings-btn"
            onClick={() => switchToTab('settings')}
            aria-label="Abrir ajustes"
            title="Configurações"
          >
            <SettingsIcon size={16} />
            <span className="hide-mobile">Configurações</span>
          </Button>
          {!isMobile && (
            <Button
              variant="o"
              className="top-glass-icon-btn"
              onClick={toggleTheme}
              aria-label={isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
              title={isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'}
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </Button>
          )}
          {!isMobile && items.length > 0 && (
            <Button variant="o" className="top-glass-reset-btn" onClick={resetWorkspace}>
              Novo planejamento
            </Button>
          )}
        </div>

      </header>

      <main className="main-viewport">
        {/* SIDE PANEL (Panel view on mobile) */}
        <aside className={`side-panel ${isMobile && mobileView === 'map' ? 'hidden' : ''}`}>
          <div className="bento-scroll">
            <div className="panel-tabbar">
              {PANEL_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`panel-tab ${activeTab === tab.key ? 'panel-tab-active' : ''}`}
                  onClick={() => switchToTab(tab.key)}
                >
                  <tab.Icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>
            <>
              {activeTab === 'optimizer' && (
                <div key="opt">
                  {items.length > 1 && (
                    <div className="counter-mode-bar">
                      <span className="config-label">Contagem</span>
                      <select
                        value={deliveryCountMode}
                        onChange={(e) => setDeliveryCountMode(e.target.value === 'stops' ? 'stops' : 'packages')}
                      >
                        <option value="packages">Por pacotes</option>
                        <option value="stops">Por paradas (agrupando quadra)</option>
                      </select>
                    </div>
                  )}
                  {/* Empty State / Hero */}
                  {status === 'idle' && items.length === 0 && (
                    <div className="animate-slide-up hero-container">
                      <div className="hero-badge">Versão 4.0</div>
                      <h1 className="hero-title">
                        Sua rota de entregas <span className="text-gradient">em poucos toques</span>
                      </h1>
                      <p className="hero-subtitle">
                        Envie a planilha e organize a ordem das entregas rapidamente.
                      </p>

                      <div className="hero-upload-section">
                        <FileUploader onUpload={handleUpload} onValidationError={m => showToast(m, 'error')} />
                      </div>

                      <div className="hero-stats-row">
                        <div className="hero-stat">
                          <span className="hero-stat-value">Até 20%</span>
                          <span className="hero-stat-label">Economia</span>
                        </div>
                        <div className="hero-divider" />
                        <div className="hero-stat">
                          <span className="hero-stat-value">Rota fácil</span>
                          <span className="hero-stat-label">Menos voltas</span>
                        </div>
                        <div className="hero-divider" />
                        <div className="hero-stat">
                          <span className="hero-stat-value">Tempo real</span>
                          <span className="hero-stat-label">Atualização</span>
                        </div>
                      </div>

                      <div className="hero-platforms">
                        <span className="platform-tag">Shopee</span>
                        <span className="platform-tag">Mercado Livre</span>
                        <span className="platform-tag">Amazon</span>
                      </div>
                    </div>
                  )}


                  {/* Processing Status */}
                  {(status === 'geocoding' || status === 'optimizing' || status === 'uploading') && (
                    <div className="bento-card text-center processing-card">
                      <div className="loading-spinner processing-spinner" />
                      <h3 className="processing-title">{processingLabel}</h3>
                      <div className="progress-bar-track processing-track">
                        <div className="progress-bar-fill processing-fill" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="processing-percent">{progress}%</p>
                    </div>
                  )}

                  {/* Pre-Calculation Bento Config */}
                  {status === 'idle' && items.length > 0 && (
                    <div className="animate-slide-up panel-stack">
                      <div className="bento-card">
                        <h3 className="planner-title">Montar rota</h3>
                        <div className="import-ready-pill">Planilha validada e pronta para otimização</div>
                        <p className="clean-muted planner-meta">{routeCountLabel}.</p>
                        {detectedCity && <p className="clean-muted planner-city">Região principal: {detectedCity}</p>}
                        <div className="planner-quick-actions">
                          <Button variant="outline" size="sm" fullWidth onClick={() => setShowAdvancedConfig((v) => !v)}>
                            {showAdvancedConfig ? 'Ocultar avançado' : 'Configurações avançadas'}
                          </Button>
                          <Button variant="outline" size="sm" fullWidth onClick={resetWorkspace}>
                            Substituir planilha
                          </Button>
                        </div>

                        <div className="planner-form-grid">
                          <div className="config-option">
                            <span className="config-label">Priorizar</span>
                            <select value={optimizeBy} onChange={e => setOptimizeBy(e.target.value)}>
                              <option value="distance">Menor distância</option>
                              <option value="duration">Menor tempo</option>
                            </select>
                          </div>
                          {showAdvancedConfig && (
                            <>
                              <div className="config-option">
                                <span className="config-label">Iniciar em</span>
                                <select value={startPointId ?? ''} onChange={e => setStartPointId(e.target.value)}>
                                  <option value="">Automático (mais eficiente)</option>
                                  {items.map((it, i) => <option key={it.id} value={it.id}>{i + 1}. {it.address}</option>)}
                                </select>
                              </div>
                              <div className="config-option">
                                <span className="config-label">Perfil</span>
                                <select value={routeProfile} onChange={e => setRouteProfile(e.target.value)}>
                                  <option value="neutral">Padrão</option>
                                  <option value="shopee">Shopee</option>
                                  <option value="mercado_livre">Mercado Livre</option>
                                </select>
                              </div>
                              <div className="config-option">
                                <span className="config-label">Reotimização contínua</span>
                                <select value={autoReoptimize ? 'on' : 'off'} onChange={(e) => setAutoReoptimize(e.target.value === 'on')}>
                                  <option value="on">Ativada (recomendada)</option>
                                  <option value="off">Desativada</option>
                                </select>
                              </div>
                            </>
                          )}
                          <Button variant="p" fullWidth size="lg" className="sticky-optimize-btn" onClick={startOptimization}>
                            <Zap size={20} fill="white" /> Otimizar rota
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ready State - Dasboard Bento */}
                  {status === 'ready' && routeInfo && (
                    <div className="animate-slide-up ready-stack">
                      {!currentItem && (
                        <div className="bento-card clean-next-stop-card">
                          <p className="finished-title">Operação concluída</p>
                          <p className="finished-subtitle">
                            Todas as entregas foram concluídas.
                          </p>
                          <div className="quick-overview-grid finished-grid">
                            <span>Prioridade: <b>{routeObjectiveLabel}</b></span>
                            <span>Concluídas: <b>{deliveryStats.done}</b></span>
                            <span>Não concluídas: <b>{deliveryStats.failed}</b></span>
                          </div>
                        </div>
                      )}

                      {currentItem && (
                        <div className="bento-card clean-next-stop-card">
                          <div className="next-stop-head">
                            <p className="config-label">Próxima entrega</p>
                            <p className="next-stop-percent">{deliveryProgressPercent}%</p>
                          </div>
                          <div className="progress-bar-track next-stop-track">
                            <div className="progress-bar-fill next-stop-fill" style={{ width: `${deliveryProgressPercent}%` }} />
                          </div>
                          <p className="next-stop-address">{currentItem.address}</p>
                          {currentItem.observation && (
                            <p className="clean-muted next-stop-ref">
                              Referência: {currentItem.observation}
                            </p>
                          )}
                          <div className="delivery-action-grid next-stop-actions">
                            <div className="secondary-actions-row secondary-actions-row-strong">
                              <Button variant="success" className="action-btn action-btn-success action-btn-status" onClick={() => markStatus(currentIdx, 'done')}>
                                Marcar entregue
                              </Button>
                              <Button variant="danger" className="action-btn action-btn-danger action-btn-status" onClick={() => markStatus(currentIdx, 'failed')}>
                                Marcar não entregue
                              </Button>
                            </div>
                            {isMobile ? (
                              <Button variant="primary" size="sm" className="action-btn action-btn-driver" onClick={() => { setOperationMode(true); setMobileView('map'); }}>
                                <Navigation size={15} /> Modo motorista
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" className="action-btn action-btn-maps action-btn-maps-secondary" onClick={openCurrentNavigation}>
                                <Navigation size={15} /> Abrir no Google Maps
                              </Button>
                            )}
                          </div>
                        </div>
                      )}

                      {upcomingStops.length > 0 && (
                        <div className="bento-card upcoming-card">
                          <p className="config-label upcoming-title">Próximas etapas</p>
                          <div className="upcoming-list">
                            {upcomingStops.map(({ item, idx }, position) => (
                              <div key={`upcoming-${item.id}`} className="upcoming-item">
                                <p className="upcoming-item-label">
                                  {position === 0 ? `Agora · Entrega ${idx + 1}` : `Depois · Entrega ${idx + 1}`}
                                </p>
                                <p className="upcoming-item-address">{item.address}</p>
                                {item.observation && (
                                  <p className="clean-muted upcoming-item-ref">
                                    Ref.: {item.observation}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Button variant="outline" size="sm" fullWidth onClick={() => setShowMoreTools((v) => !v)}>
                        {showMoreTools ? 'Ocultar ferramentas' : 'Ferramentas'}
                      </Button>

                      {showMoreTools && (
                        <>
                          <div className="secondary-actions-row">
                            <Button variant="o" size="sm" fullWidth onClick={() => setStatus('idle')}>
                              <RefreshCw size={15} /> Reiniciar operação
                            </Button>
                            <Button variant="outline" size="sm" fullWidth onClick={saveCurrentRoute}>
                              Salvar no histórico
                            </Button>
                          </div>
                          <Button variant="outline" size="sm" fullWidth onClick={() => setShowStopList((v) => !v)}>
                            {showStopList ? 'Ocultar lista completa' : 'Ver lista completa'}
                          </Button>
                          {showStopList && (
                            <RouteDetails
                              items={items}
                              stopStatuses={stopStatuses}
                              deliveryCountMode={deliveryCountMode}
                              onActionFeedback={showToast}
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
                          )}
                          <Button variant="outline" size="sm" fullWidth onClick={() => setShowRouteSummary((v) => !v)}>
                            {showRouteSummary ? 'Ocultar resumo operacional' : 'Ver resumo operacional'}
                          </Button>
                        </>
                      )}
                      {isMobile && (
                        <Button variant="primary" fullWidth onClick={openCurrentNavigation}>
                          <Navigation size={16} /> Abrir no Google Maps
                        </Button>
                      )}
                      {showMoreTools && showRouteSummary && (
                        <div className="bento-card summary-card">
                          <p className="config-label">Resumo</p>
                          <div className="summary-grid">
                            <div>
                              <p className="summary-label">Distância total</p>
                              <p className="summary-value">{optimizedKm !== null ? `${optimizedKm.toFixed(1)} km` : '--'}</p>
                            </div>
                            <div>
                              <p className="summary-label">Combustível (estimado)</p>
                              <p className="summary-value">{estimatedFuelCost !== null ? `R$ ${estimatedFuelCost.toFixed(2)}` : '--'}</p>
                            </div>
                          </div>
                          {baselineKm !== null && baselineMin !== null && optimizedMin !== null && (
                            <div className="summary-compare-wrap">
                              <p className="summary-compare">
                                Antes: <b>{baselineKm.toFixed(1)} km / {baselineMin} min</b> · Agora: <b>{optimizedKm?.toFixed(1)} km / {optimizedMin} min</b>
                              </p>
                              <p className="summary-saving">
                                Você economizou: {savedKm !== null ? `${savedKm.toFixed(1)} km` : '--'} e {savedMin !== null ? `${savedMin} min` : '--'}
                              </p>
                              {routeQuality && (
                                <p className={`summary-quality ${routeQuality.tone === 'success' ? 'summary-quality-success' : ''}`}>
                                  Qualidade da rota: {routeQuality.label}
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
                    setStartPointId(l.startPointId ?? null);
                    setDeliveryCountMode(l.deliveryCountMode === 'packages' ? 'packages' : 'stops');
                    setStopStatuses(buildInitialStopStatuses(l.items || []));
                    setStatus(l.routeInfo ? 'ready' : 'idle');
                    setShowStopList(false);
                    setShowMoreTools(false);
                    setShowAdvancedConfig(false);
                    setOperationMode(false);
                    switchToTab('optimizer');
                  }} />
                </div>
              )}

              {activeTab === 'settings' && (
                <div key="set">
                  <SettingsPanel
                    onClearWorkspace={resetWorkspace}
                    onClearHistory={() => persistHistory([])}
                    onOpenHistory={() => switchToTab('history')}
                    onBackToOptimizer={() => switchToTab('optimizer')}
                    onToggleTheme={toggleTheme}
                    isDarkMode={isDarkMode}
                    onInstallApp={handleInstallApp}
                    isAppInstalled={isAppInstalled}
                  />
                </div>
              )}
            </>
          </div>
        </aside>

        {/* MAP VIEWPORT */}
        <div className="map-viewport">
          <Suspense fallback={<div className="loading-spinner"></div>}>
            <MapView items={items} routeGeometry={routeInfo?.geometry} stopStatuses={stopStatuses} nextStopIndex={currentIdx} deliveryCountMode={deliveryCountMode} isVisible={!(isMobile && mobileView === 'panel')} />
          </Suspense>

          {/* Floating Mobile Map HUD */}
          {isMobile && !operationMode && mobileView === 'map' && status === 'ready' && currentItem && (
            <div className="hud-card">
              <div className="hud-head">
                <div className="status-glow" />
                <span className="hud-title">PRÓXIMA ENTREGA</span>
              </div>
              {deliveryCountMode === 'stops' && currentStopInfo && (
                <p className="clean-muted" style={{ marginBottom: '0.25rem', fontWeight: 700 }}>
                  PARADA {currentStopInfo.stopOrder} · {pluralize(currentStopInfo.packageCount, 'pacote')}
                </p>
              )}
              {deliveryCountMode === 'stops' && currentStopProgress && (
                <p className="clean-muted" style={{ marginBottom: '0.25rem', fontWeight: 700 }}>
                  {currentStopProgress.done}/{currentStopProgress.total} entregues · {currentStopProgress.pending} pendente(s)
                </p>
              )}
              <h2 className="hud-address">{currentItem.address}</h2>
              <div className="hud-action-grid">
                <button type="button" className="btn-elite btn-p hud-action-btn" onClick={openCurrentNavigation}>
                  <Navigation size={18} fill="white" /> Navegar
                </button>
                <button type="button" className="btn-elite btn-success hud-action-btn" onClick={() => markStatus(currentIdx, 'done')}>
                  Marcar entregue
                </button>
                <button type="button" className="btn-elite btn-danger hud-action-btn" onClick={() => markStatus(currentIdx, 'failed')}>
                  Marcar não entregue
                </button>
              </div>
              {deliveryCountMode === 'stops' && currentStopInfo?.itemIds?.length > 1 && (
                <div className="hud-action-grid" style={{ marginTop: '0.45rem' }}>
                  <button type="button" className="btn-elite btn-success hud-action-btn" onClick={() => markStopByItemIds(currentStopInfo.itemIds, 'done')}>
                    Entregue parada
                  </button>
                  <button type="button" className="btn-elite btn-danger hud-action-btn" onClick={() => markStopByItemIds(currentStopInfo.itemIds, 'failed')}>
                    Falha parada
                  </button>
                </div>
              )}
            </div>
          )}

          {isMobile && operationMode && status === 'ready' && (
            <div className="operation-mode-overlay">
              <div className="operation-mode-head">
                <span>Tela do motorista · {activeFiltersLabel}</span>
                <button
                  type="button"
                  className="operation-close-btn"
                  onClick={() => setDriverDetailMode((mode) => (mode === 'detailed' ? 'compact' : 'detailed'))}
                >
                  {driverDetailMode === 'detailed' ? 'Compactar' : 'Detalhar'}
                </button>
                <button type="button" className="operation-close-btn" onClick={() => setOperationMode(false)}>
                  Fechar
                </button>
              </div>
              {currentItem ? (
                <>
                  <p className="operation-label">PRÓXIMA ENTREGA</p>
                  {deliveryCountMode === 'stops' && currentStopInfo && (
                    <p className="operation-label">
                      PARADA {currentStopInfo.stopOrder} · {pluralize(currentStopInfo.packageCount, 'pacote')}
                    </p>
                  )}
                  {deliveryCountMode === 'stops' && currentStopProgress && (
                    <p className="operation-label">
                      {currentStopProgress.done}/{currentStopProgress.total} entregues · {currentStopProgress.pending} pendente(s)
                    </p>
                  )}
                  {driverDetailMode === 'detailed' && <h2 className="operation-address">{currentItem.address}</h2>}

                  <div className="primary-actions-bottom-row">
                    <button type="button" className="operation-btn operation-btn-success" onClick={() => markStatus(currentIdx, 'done')}>
                      Marcar entregue
                    </button>
                    <button type="button" className="operation-btn operation-btn-primary" onClick={openCurrentNavigation}>
                      <Navigation size={20} /> Abrir no Maps
                    </button>
                    <button type="button" className="operation-btn operation-btn-danger" onClick={() => markStatus(currentIdx, 'failed')}>
                      Marcar não entregue
                    </button>
                  </div>
                  {deliveryCountMode === 'stops' && currentStopInfo?.itemIds?.length > 1 && (
                    <div className="primary-actions-bottom-row" style={{ marginTop: '0.55rem' }}>
                      <button type="button" className="operation-btn operation-btn-success" onClick={() => markStopByItemIds(currentStopInfo.itemIds, 'done')}>
                        Entregue parada
                      </button>
                      <button type="button" className="operation-btn operation-btn-danger" onClick={() => markStopByItemIds(currentStopInfo.itemIds, 'failed')}>
                        Falha parada
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="operation-label">CONCLUÍDO</p>
                  <h2 className="operation-address">Todas as entregas foram finalizadas.</h2>
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
            type="button"
            className={`nav-item ${mobileView === 'panel' && activeTab === 'optimizer' ? 'active' : ''}`}
            onClick={() => switchToTab('optimizer')}
          >
            <LayoutGrid size={18} />
            Início
          </button>
          <button
            type="button"
            className={`nav-item ${mobileView === 'map' ? 'active' : ''}`}
            onClick={() => setMobileView('map')}
          >
            <MapIcon size={18} />
            Mapa
          </button>

          <button
            type="button"
            className="nav-action-center"
            onClick={() => (currentItem ? openCurrentNavigation() : startOptimization())}
            disabled={!currentItem && status !== 'idle'}
          >
            {status === 'ready' ? <Navigation size={20} fill="white" /> : <Play size={20} fill="white" />}
            {status === 'ready' ? 'Navegar' : 'Otimizar'}
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
        <div className="app-toast app-toast-info app-toast-queue">
          {pendingActions.length} ação(ões) aguardando internet
        </div>
      )}
    </div>
  );
}

export default App;
