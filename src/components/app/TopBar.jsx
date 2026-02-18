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
                        <Truck size={24} strokeWidth={2.5} />
                    </div>
                    <div className="hide-mobile">
                        <h1 className="brand-title">RotaMestra <span className="brand-title-sub">Pro</span></h1>
                    </div>
                </div>

                <div className="topbar-actions">
                    {isMobileViewport && (
                        <div className="mobile-view-toggle">
                            <button
                                className={`mobile-view-btn ${mobileView === 'panel' ? 'mobile-view-btn-active' : ''}`}
                                onClick={() => setMobileView('panel')}
                                aria-label="Exibir painel"
                            >
                                Painel
                            </button>
                            <button
                                className={`mobile-view-btn ${mobileView === 'map' ? 'mobile-view-btn-active' : ''}`}
                                onClick={() => setMobileView('map')}
                                aria-label="Exibir mapa"
                            >
                                Mapa
                            </button>
                        </div>
                    )}

                    <div className="topbar-tabs">
                        <button className={`btn btn-icon ${activeTab === 'optimizer' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('optimizer')} aria-label="Aba otimizador">
                            <LayoutDashboard size={18} />
                        </button>
                        <button className={`btn btn-icon ${activeTab === 'settings' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('settings')} aria-label="Aba preferências">
                            <SettingsIcon size={18} />
                        </button>
                        <button className={`btn btn-icon ${activeTab === 'history' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('history')} aria-label="Aba histórico">
                            <History size={18} />
                        </button>
                    </div>

                    <button className="btn btn-outline btn-icon" onClick={toggleTheme} style={{ borderRadius: '12px' }} aria-label="Alternar tema">
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    {status === 'ready' && (
                        <button className={`btn ${isFieldMode ? 'btn-primary' : 'btn-outline'}`} onClick={() => setIsFieldMode((v) => !v)} style={{ borderRadius: '12px' }}>
                            <LocateFixed size={18} /> <span className="hide-mobile">Modo Campo</span>
                        </button>
                    )}

                    {!isMobileViewport && itemsLength > 0 && (
                        <Button variant="danger" onClick={onReset} style={{ borderRadius: '12px' }}>
                            <Trash2 size={18} /> <span className="hide-mobile">Limpar</span>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
};

export default TopBar;
