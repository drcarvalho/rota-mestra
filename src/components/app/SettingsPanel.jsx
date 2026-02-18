import React from 'react';
import { Settings, Trash2, History, Moon, Sun, LayoutGrid } from 'lucide-react';
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
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Ajustes rápidos do aplicativo.
                </p>

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
