import React from 'react';
import { Settings, Trash2, History, Shield, HardDrive, Moon, Sun, LayoutGrid } from 'lucide-react';
import Card from '../ui/Card';
import SectionHeader from '../ui/SectionHeader';
import Button from '../ui/Button';

const SettingsPanel = ({
    onClearWorkspace,
    onClearHistory,
    onOpenHistory,
    onBackToOptimizer,
    onToggleTheme,
    isDarkMode
}) => {
    return (
        <Card className="animate-fade-in">
            <SectionHeader
                title={(
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Settings size={17} color="var(--primary)" /> Preferências
                    </span>
                )}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Info section */}
                <div style={{
                    padding: '0.85rem',
                    background: 'var(--primary-light)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(var(--primary-rgb), 0.08)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <HardDrive size={14} color="var(--primary)" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>Armazenamento Local</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        Seus dados ficam salvos no navegador. Nenhuma informação é enviada para servidores externos.
                    </p>
                </div>

                {/* Privacy */}
                <div style={{
                    padding: '0.85rem',
                    background: 'rgba(var(--success-rgb), 0.04)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(var(--success-rgb), 0.1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <Shield size={14} color="var(--success)" />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success)' }}>Privacidade</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        A geocodificação usa OpenStreetMap (Nominatim) e as rotas são calculadas via OSRM — ambos gratuitos e de código aberto.
                    </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <Button variant="outline" onClick={onBackToOptimizer} fullWidth>
                        <LayoutGrid size={15} /> Voltar para painel
                    </Button>
                    <Button variant="outline" onClick={onOpenHistory} fullWidth>
                        <History size={15} /> Abrir histórico
                    </Button>
                    <Button variant="outline" onClick={onToggleTheme} fullWidth>
                        {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
                        {isDarkMode ? 'Tema claro' : 'Tema escuro'}
                    </Button>
                    <Button variant="outline" onClick={onClearWorkspace} fullWidth>
                        <Trash2 size={15} /> Limpar sessão salva
                    </Button>
                    <Button variant="outline" onClick={onClearHistory} fullWidth>
                        <History size={15} /> Limpar histórico de rotas
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default SettingsPanel;
