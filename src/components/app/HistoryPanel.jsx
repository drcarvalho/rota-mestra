import React from 'react';
import { Clock, Trash2, MapPin } from 'lucide-react';
import Card from '../ui/Card';
import SectionHeader from '../ui/SectionHeader';
import Button from '../ui/Button';

const HistoryPanel = ({ routeHistory, onClear, onLoad }) => {
    return (
        <Card className="animate-fade-in">
            <SectionHeader
                title={(
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={17} color="var(--primary)" /> Histórico de Rotas
                    </span>
                )}
                subtitle="Recupere planejamentos anteriores com um toque."
                actions={(
                    <Button variant="outline" size="sm" onClick={onClear} disabled={routeHistory.length === 0}>
                        <Trash2 size={14} /> Apagar histórico
                    </Button>
                )}
            />
            {routeHistory.length === 0 && (
                <div className="history-empty-state">
                    <Clock size={32} color="var(--border)" style={{ marginBottom: '0.5rem' }} />
                    <p>Nenhuma rota salva ainda.</p>
                </div>
            )}
            <div className="history-list">
                {routeHistory.map((entry) => (
                    <button
                        key={entry.id}
                        className="history-item-btn"
                        onClick={() => onLoad(entry)}
                    >
                        <span className="history-item-main">
                            <MapPin size={14} color="var(--primary)" />
                            <span>{entry.title}</span>
                        </span>
                        <span className="history-item-meta">
                            {entry.items?.length || 0} paradas
                        </span>
                    </button>
                ))}
            </div>
        </Card>
    );
};

export default HistoryPanel;
