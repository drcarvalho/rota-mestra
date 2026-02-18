import { useEffect, useState } from 'react';

const safeStorageRead = (key) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const safeStorageWrite = (key, value) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Storage can fail in private mode or when quota is exceeded.
    }
};

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
        const savedWorkspace = safeStorageRead(storageKey);
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
        safeStorageWrite(storageKey, JSON.stringify(payload));
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
        let savedHistory = null;
        try {
            savedHistory = localStorage.getItem(historyKey);
        } catch {
            savedHistory = null;
        }
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
        try {
            localStorage.setItem(historyKey, JSON.stringify(nextHistory));
        } catch {
            // noop
        }
    };

    return { routeHistory, persistHistory };
};
