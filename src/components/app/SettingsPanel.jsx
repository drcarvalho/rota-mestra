import React from 'react';
import { Settings, Trash2, History, Moon, Sun, LayoutGrid, Download, CheckCircle2 } from 'lucide-react';
import Card from '../ui/Card';
import SectionHeader from '../ui/SectionHeader';
import Button from '../ui/Button';

const SettingsPanel = ({
    onClearWorkspace,
    onClearHistory,
    onOpenHistory,
    onBackToOptimizer,
    onToggleTheme,
    isDarkMode,
    onInstallApp,
    isAppInstalled
}) => {
    return (
        <Card className="animate-fade-in">
            <SectionHeader
                title={(
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Settings size={17} color="var(--primary)" /> Preferências
                    </span>
                )}
                subtitle="Personalize aparência, histórico e sessão atual."
            />

            <div className="settings-body">
                <p className="settings-intro">
                    Ações rápidas para personalizar e organizar sua operação.
                </p>

                {/* Actions */}
                <div className="settings-actions">
                    <Button variant="outline" onClick={onBackToOptimizer} fullWidth>
                        <LayoutGrid size={15} /> Voltar ao planejamento
                    </Button>
                    <Button variant="outline" onClick={onOpenHistory} fullWidth>
                        <History size={15} /> Ver histórico
                    </Button>
                    <Button variant="outline" onClick={onToggleTheme} fullWidth>
                        {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
                        {isDarkMode ? 'Usar tema claro' : 'Usar tema escuro'}
                    </Button>
                    {!isAppInstalled && (
                        <Button variant="primary" onClick={onInstallApp} fullWidth>
                            <Download size={15} /> Instalar app na área de trabalho
                        </Button>
                    )}
                    {isAppInstalled && (
                        <Button variant="outline" disabled fullWidth>
                            <CheckCircle2 size={15} /> App já instalado neste dispositivo
                        </Button>
                    )}
                    <Button variant="outline" onClick={onClearWorkspace} fullWidth>
                        <Trash2 size={15} /> Limpar sessão atual
                    </Button>
                    <Button variant="outline" onClick={onClearHistory} fullWidth>
                        <History size={15} /> Apagar histórico de rotas
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default SettingsPanel;
