import React, { useState, useEffect } from 'react';
import { PictureOutlined } from '@ant-design/icons';
import '../styles/AdPlaceholder.css';

const DEFAULT_LOGO_URL = '/logo.png';

const AdPlaceholder = ({
    ratio,
    label,
    className = '',
    width = '100%',
    height = 'auto',
    style: customStyle
}) => {
    const [logoUrl, setLogoUrl] = useState('');
    useEffect(() => {
        const loadLogo = async () => {
            try {
                if (typeof window !== 'undefined' && !window.electron) {
                    setLogoUrl(DEFAULT_LOGO_URL);
                    return;
                }
                // eslint-disable-next-line no-undef
                const electron = window.require ? window.require('electron') : null;
                if (electron?.ipcRenderer) {
                    const url = await electron.ipcRenderer.invoke('get-resource-url', 'kq.png');
                    if (url) {
                        setLogoUrl(url);
                    } else {
                        setLogoUrl(DEFAULT_LOGO_URL);
                    }
                } else {
                    setLogoUrl(DEFAULT_LOGO_URL);
                }
            } catch (e) {
                console.error('Failed to load placeholder logo', e);
                setLogoUrl(DEFAULT_LOGO_URL);
            }
        };
        loadLogo();
    }, []);

    const containerStyle = {
        aspectRatio: ratio ? `${ratio}` : undefined,
        width,
        height,
        borderRadius: '8px',
        boxSizing: 'border-box',
        WebkitAppRegion: 'no-drag',
        cursor: 'default',
        padding: '12px',
        ...customStyle
    };

    const isLoading = label.includes('加载中');
    const isSmall = ratio && ratio > 3; // For 4:1 banner (small height)

    return (
        <div className={`ad-placeholder ${className} ${isLoading ? 'loading' : ''}`} style={containerStyle}>
            {isLoading ? (
                // Loading State
                <>
                    <div className="ad-placeholder-shimmer"></div>
                    <span className="ad-placeholder-text">{label}</span>
                </>
            ) : (
                // Branding State (Empty Ad)
                <div className={`ad-branding-container ${isSmall ? 'small' : ''}`}>
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="ad-branding-logo" />
                    ) : (
                        <PictureOutlined className="ad-branding-icon" />
                    )}
                    <div className="ad-branding-content">
                        <div className="ad-branding-title">鲲穹AI</div>
                        <div className="ad-branding-slogan">让办公更高效</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdPlaceholder;
