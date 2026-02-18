import { useEffect, useState } from 'react';

export const useWorkspacePersistence = ({
    storageKey,
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
}) => {
    useEffect(() => {
        const savedWorkspace = localStorage.getItem(storageKey);
        if (!savedWorkspace) return;

        try {
            const parsed = JSON.parse(savedWorkspace);
            if (Array.isArray(parsed.items)) setItems(parsed.items);
            if (parsed.routeInfo && typeof parsed.routeInfo === 'object') setRouteInfo(parsed.routeInfo);
            if (typeof parsed.roundTrip === 'boolean') setRoundTrip(parsed.roundTrip);
            if (parsed.startPointId !== undefined && parsed.startPointId !== null) setStartPointId(parsed.startPointId);
            if (parsed.optimizeBy === 'distance' || parsed.optimizeBy === 'duration') setOptimizeBy(parsed.optimizeBy);
            if (parsed.stopStatuses && typeof parsed.stopStatuses === 'object') setStopStatuses(parsed.stopStatuses);
            if (parsed.status === 'ready' && parsed.routeInfo && Array.isArray(parsed.items) && parsed.items.length > 0) {
                setStatus('ready');
            }
        } catch (workspaceError) {
            console.error('Falha ao restaurar dados locais:', workspaceError);
        }
    }, [
        storageKey,
        setItems,
        setRouteInfo,
        setRoundTrip,
        setStartPointId,
        setOptimizeBy,
        setStopStatuses,
        setStatus
    ]);

    useEffect(() => {
        if (status === 'uploading' || status === 'geocoding' || status === 'optimizing') return;

        const payload = {
            items,
            routeInfo,
            roundTrip,
            startPointId,
            optimizeBy,
            stopStatuses,
            status: status === 'ready' ? 'ready' : 'idle'
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
    }, [
        storageKey,
        items,
        routeInfo,
        roundTrip,
        startPointId,
        optimizeBy,
        stopStatuses,
        status
    ]);
};

export const useRouteHistory = (historyKey) => {
    const [routeHistory, setRouteHistory] = useState(() => {
        const savedHistory = localStorage.getItem(historyKey);
        if (!savedHistory) return [];
        try {
            const parsed = JSON.parse(savedHistory);
            if (Array.isArray(parsed)) return parsed;
        } catch (historyError) {
            console.error('Falha ao restaurar histórico:', historyError);
        }
        return [];
    });

    const persistHistory = (nextHistory) => {
        setRouteHistory(nextHistory);
        localStorage.setItem(historyKey, JSON.stringify(nextHistory));
    };

    return { routeHistory, persistHistory };
};
