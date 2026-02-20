import React from 'react';
import {
    Navigation,
    MapPin,
    Download,
    ExternalLink,
    CheckCircle2,
    XCircle,
    Copy,
    Search
} from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import SectionHeader from './ui/SectionHeader';
import StatusBadge from './ui/StatusBadge';
import { buildStopGroups } from '../utils/stopGrouping';

const RouteDetails = ({ items, stopStatuses = {}, deliveryCountMode = 'packages', onMarkDone, onMarkFailed, onCopyAddress, onActionFeedback }) => {
    const [searchTerm, setSearchTerm] = React.useState('');
    const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
    const routeItems = React.useMemo(() => (Array.isArray(items) ? items : []), [items]);

    const openGoogleMaps = () => {
        if (routeItems.length < 2) {
            onActionFeedback?.('Adicione pelo menos duas entregas para abrir a rota no Google Maps.', 'info');
            return;
        }
        const origin = routeItems[0].address;
        const waypoints = routeItems.slice(1, -1).map((i) => i.address).join('|');
        const destination = routeItems[routeItems.length - 1].address;
        const waypointsParam = waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '';
        const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const openNextStopGoogleMaps = () => {
        const next = routeItems.find((item, idx) => idx > 0 && (stopStatuses[String(item.id)] || 'pending') === 'pending');
        if (!next) {
            onActionFeedback?.('Nenhuma entrega pendente para navegação.', 'info');
            return;
        }
        const destination = next.coords
            ? `${next.coords.lat},${next.coords.lon}`
            : next.address;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const exportCSV = () => {
        const headers = ['Ordem', 'Status', 'Endereço', 'Observação', 'Lat', 'Lon', 'Estimativa Chegada'];
        const rows = routeItems.map((item, idx) => [
            idx + 1,
            idx === 0 ? 'partida' : (stopStatuses[String(item.id)] || 'pending'),
            `"${item.address.replace(/"/g, '""')}"`,
            `"${String(item.observation || '').replace(/"/g, '""')}"`,
            item.coords?.lat || '',
            item.coords?.lon || '',
            `+${idx * 5} min`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((row) => row.join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'rota_profissional_mestra.csv');
        link.click();
        onActionFeedback?.('Arquivo CSV salvo.', 'success');
    };

    const statusMeta = (item, idx) => {
        if (idx === 0) return { label: 'Partida', color: '#10b981', background: 'rgba(16, 185, 129, 0.06)' };
        const value = stopStatuses[String(item.id)] || 'pending';
        if (value === 'done') return { label: 'Entregue', color: '#10b981', background: 'rgba(16, 185, 129, 0.06)' };
        if (value === 'failed') return { label: 'Não entregue', color: '#ef4444', background: 'rgba(239, 68, 68, 0.06)' };
        return { label: 'Pendente', color: '#3b82f6', background: 'var(--bg)' };
    };

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const indexedItems = routeItems.map((item, idx) => ({ item, idx }));
    const filteredItems = indexedItems.filter(({ item, idx }) =>
        String(item.address || '').toLowerCase().includes(normalizedSearch) ||
        String(idx + 1).includes(normalizedSearch)
    );
    const showSearch = routeItems.length > 20;
    const hasPendingStop = routeItems.some((item, idx) => idx > 0 && (stopStatuses[String(item.id)] || 'pending') === 'pending');
    const hasRouteToOpen = routeItems.length >= 2;
    const stopGroups = React.useMemo(() => buildStopGroups(routeItems), [routeItems]);
    const itemIndexById = React.useMemo(() => {
        const map = new Map();
        routeItems.forEach((item, idx) => map.set(String(item.id), idx));
        return map;
    }, [routeItems]);

    if (routeItems.length === 0) return null;

    const handlePrint = () => {
        if (routeItems.length === 0) {
            onActionFeedback?.('Não há entregas para imprimir.', 'info');
            return;
        }
        window.print();
    };

    return (
        <div className="route-details-wrap">
            <Card style={{ padding: '1rem' }}>
                <SectionHeader
                    title={(
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                            <MapPin size={17} color="var(--primary)" /> Lista operacional
                        </span>
                    )}
                    actions={(
                        <Button variant="outline" className="btn-icon" onClick={exportCSV} title="Baixar CSV" aria-label="Baixar CSV">
                            <Download size={17} />
                        </Button>
                    )}
                />

                {showSearch && (
                    <div className="route-search-wrap">
                        <Search size={14} className="route-search-icon" />
                        <input
                            type="text"
                            placeholder="Buscar endereço ou número da sequência..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="route-search-input"
                        />
                    </div>
                )}

                {deliveryCountMode === 'stops' && stopGroups.length > 0 && (
                    <div style={{ marginBottom: '0.8rem', display: 'grid', gap: '0.55rem' }}>
                        <p className="config-label">Visão por paradas</p>
                        {stopGroups.map((group) => {
                            const stats = group.items.reduce((acc, packageItem) => {
                                const statusValue = stopStatuses[String(packageItem.id)] || 'pending';
                                if (statusValue === 'done') acc.done += 1;
                                else if (statusValue === 'failed') acc.failed += 1;
                                else acc.pending += 1;
                                return acc;
                            }, { done: 0, failed: 0, pending: 0 });
                            const groupAddress = group.items[0]?.address || '-';
                            return (
                                <details key={group.key} className="route-stop-item" style={{ padding: '0.7rem', borderRadius: '12px' }}>
                                    <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
                                        <span style={{ fontWeight: 800 }}>Parada {group.stopOrder}</span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                            {pluralize(group.items.length, 'pacote')} · {stats.pending} pendente(s)
                                        </span>
                                    </summary>
                                    <p style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{groupAddress}</p>
                                    <div style={{ marginTop: '0.45rem', display: 'grid', gap: '0.35rem' }}>
                                        {group.items.map((packageItem, packageLocalIndex) => {
                                            const packageIndex = group.indices[packageLocalIndex] ?? itemIndexById.get(String(packageItem.id)) ?? 0;
                                            const statusValue = stopStatuses[String(packageItem.id)] || 'pending';
                                            const statusLabel = statusValue === 'done' ? 'Entregue' : statusValue === 'failed' ? 'Não entregue' : 'Pendente';
                                            return (
                                                <div key={packageItem.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.48rem 0.55rem', background: 'rgba(var(--card-bg-rgb),0.75)' }}>
                                                    <p style={{ fontWeight: 700, fontSize: '0.78rem' }}>Pacote #{packageIndex + 1} {packageItem.label ? `· ${packageItem.label}` : ''}</p>
                                                    <p style={{ fontSize: '0.76rem', marginTop: '0.18rem' }}>{packageItem.address}</p>
                                                    {packageItem.observation && (
                                                        <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.08rem' }}>
                                                            Ref.: {packageItem.observation}
                                                        </p>
                                                    )}
                                                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>Status: {statusLabel}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </details>
                            );
                        })}
                    </div>
                )}

                <div className="route-stops-scroll custom-scroll">
                    {filteredItems.map(({ item, idx }) => {
                        const meta = statusMeta(item, idx);
                        const badgeTone = meta.label === 'Entregue' ? 'success' : meta.label === 'Não entregue' ? 'error' : meta.label === 'Pendente' ? 'warning' : 'info';
                        return (
                            <div key={item.id} className="route-stop-item" style={{ background: meta.background, borderColor: idx === 0 ? 'var(--success)' : undefined }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                                    <div className="route-stop-number" style={{ background: meta.color }}>
                                        {idx + 1}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {idx === 0 ? 'Ponto de Partida' : item.address}
                                        </p>
                                        {idx > 0 && item.observation && (
                                            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.08rem' }}>
                                                Ref.: {item.observation}
                                            </p>
                                        )}
                                        <StatusBadge tone={badgeTone} label={meta.label} />
                                    </div>
                                </div>
                                {idx > 0 && (
                                    <div className="route-stop-actions">
                                        <Button variant="success" size="sm" className="route-stop-mini-btn" onClick={() => onMarkDone?.(idx)}>
                                            <CheckCircle2 size={13} /> Concluir
                                        </Button>
                                        <Button variant="danger" size="sm" className="route-stop-mini-btn" onClick={() => onMarkFailed?.(idx)}>
                                            <XCircle size={13} /> Marcar falha
                                        </Button>
                                        <Button variant="outline" size="sm" className="route-stop-mini-btn" onClick={() => onCopyAddress?.(item.address)}>
                                            <Copy size={13} /> Copiar
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </Card>

            <Card style={{ padding: '0.9rem' }}>
                <SectionHeader title="Navegação" subtitle="Envie a próxima etapa ou a rota completa para o Google Maps." />
                <div className="route-external-actions">
                    <Button variant="primary" onClick={openNextStopGoogleMaps} disabled={!hasPendingStop}>
                        <Navigation size={16} /> Navegar para próxima etapa
                    </Button>
                    <Button variant="outline" onClick={openGoogleMaps} disabled={!hasRouteToOpen}>
                        <ExternalLink size={16} /> Abrir rota no Maps
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePrint} style={{ gridColumn: '1 / -1' }} disabled={items.length === 0}>
                        Imprimir lista operacional
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default RouteDetails;
