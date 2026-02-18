import React from 'react';
import {
    Truck,
    LayoutDashboard,
    Settings as SettingsIcon,
    History,
    Moon,
    Sun,
    LocateFixed,
    Trash2
} from 'lucide-react';
import Button from '../ui/Button';

const TopBar = ({
    isMobileViewport,
    mobileView,
    setMobileView,
    activeTab,
    setActiveTab,
    toggleTheme,
    isDarkMode,
    status,
    isFieldMode,
    setIsFieldMode,
    itemsLength,
    onReset
}) => {
    return (
        <header>
            <div className="topbar-shell">
                <div className="brand-row">
                    <div className="brand-icon">
                        <Truck size={22} strokeWidth={2.5} />
                    </div>
                    <div className="hide-mobile">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h1 className="brand-title">RotaBoa</h1>
                            <span className="version-tag">v2.0</span>
                        </div>
                        <p className="brand-subtitle">Otimizador de Rotas Inteligente</p>
                    </div>
                </div>

                <div className="topbar-actions">
                    {isMobileViewport && (
                        <div className="mobile-view-toggle">
                            <button
                                className={`mobile-view-btn ${mobileView === 'panel' ? 'mobile-view-btn-active' : ''}`}
                                onClick={() => setMobileView('panel')}
                                aria-label="Abrir painel"
                            >
                                Painel
                            </button>
                            <button
                                className={`mobile-view-btn ${mobileView === 'map' ? 'mobile-view-btn-active' : ''}`}
                                onClick={() => setMobileView('map')}
                                aria-label="Abrir mapa"
                            >
                                Mapa
                            </button>
                        </div>
                    )}

                    <div className="topbar-tabs">
                        <button className={`btn btn-icon ${activeTab === 'optimizer' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('optimizer')} aria-label="Aba otimizador" title="Otimizador">
                            <LayoutDashboard size={17} />
                        </button>
                        <button className={`btn btn-icon ${activeTab === 'settings' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('settings')} aria-label="Aba preferências" title="Preferências">
                            <SettingsIcon size={17} />
                        </button>
                        <button className={`btn btn-icon ${activeTab === 'history' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('history')} aria-label="Aba histórico" title="Histórico">
                            <History size={17} />
                        </button>
                    </div>

                    <button className="btn btn-outline btn-icon" onClick={toggleTheme} style={{ borderRadius: '12px' }} aria-label="Alternar tema" title={isDarkMode ? 'Modo claro' : 'Modo escuro'}>
                        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                    </button>

                    {status === 'ready' && (
                        <button className={`btn ${isFieldMode ? 'btn-primary' : 'btn-outline'}`} onClick={() => setIsFieldMode((v) => !v)} style={{ borderRadius: '12px' }} title="Modo motorista em campo">
                            <LocateFixed size={17} /> <span className="hide-mobile">Modo motorista</span>
                        </button>
                    )}

                    {!isMobileViewport && itemsLength > 0 && (
                        <Button variant="danger" onClick={onReset} style={{ borderRadius: '12px' }}>
                            <Trash2 size={17} /> <span className="hide-mobile">Nova rota</span>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopBar;
