import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ConfigProvider, theme as antTheme } from 'antd';
import MainPage from './pages/MainPage';
import { useThemeStore } from './stores/useThemeStore';
import { I18nProvider } from './i18n/I18nProvider';
import './App.css';

function App() {
  const theme = useThemeStore((state) => state.theme);
  const isDark = theme === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: isDark ? '#60a5fa' : '#2563eb',
          colorBgContainer: isDark ? '#1e293b' : '#ffffff',
          colorBgElevated: isDark ? '#1e293b' : '#ffffff',
          colorText: isDark ? '#f1f5f9' : '#1e293b',
          colorTextSecondary: isDark ? '#94a3b8' : '#64748b',
          borderRadius: 8,
        },
        components: {
          Modal: {
            contentBg: isDark ? '#1e293b' : '#ffffff',
            headerBg: isDark ? '#1e293b' : '#ffffff',
          }
        }
      }}
    >
      <I18nProvider>
        <Router>
          <Toaster
            position="top-right"
            containerStyle={{
              top: 70,
            }}
            toastOptions={{
              duration: 3000,
              style: {
                background: 'var(--card-bg)',
                color: 'var(--text-primary)',
                boxShadow: 'var(--shadow-md)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '14px',
                fontWeight: '500',
                minHeight: '48px',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 4000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/tool/:source/:target" element={<MainPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </I18nProvider>
    </ConfigProvider>
  );
}

export default App;
