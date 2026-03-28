import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { message } from 'antd';
import { AuthService } from '../services/auth';

export const useUserStore = create(
    persist(
        (set, get) => ({
            token: null,
            userInfo: null,
            isLoggedIn: false,
            isPolling: false,
            loginUrl: null,
            encodedNonce: null,

            // Internal timer reference
            _pollTimer: null,

            // Modal State
            isLoginModalVisible: false,
            showLoginModal: () => set({ isLoginModalVisible: true }),
            hideLoginModal: () => set({ isLoginModalVisible: false }),

            startLoginProcess: async () => {
                try {
                    const { url, encodedNonce } = await AuthService.getLoginUrl();

                    // Clear existing timer if any
                    const { _pollTimer, stopLoginProcess } = get();
                    if (_pollTimer) stopLoginProcess();

                    set({ isPolling: true, loginUrl: url, encodedNonce });

                    // Open Browser
                    const popup = window.open(url, '_blank', 'noopener,noreferrer');
                    if (!popup) {
                        message.warning('浏览器拦截了登录弹窗，请允许弹窗后重试');
                    }

                    // Start Polling
                    const timer = setInterval(async () => {
                        const success = await get().checkPolling();
                        if (success) {
                            get().stopLoginProcess(); // Stop polling on success
                        }
                    }, 3000); // Poll every 3 seconds

                    set({ _pollTimer: timer });

                    // Auto-stop after 300s
                    setTimeout(() => {
                        const { isPolling } = get();
                        if (isPolling) {
                            message.warning('登录请求已超时，请重试');
                            get().stopLoginProcess();
                        }
                    }, 300000);

                    return url;
                } catch (error) {
                    console.error("Failed to start login process:", error);
                    message.error(`启动登录界面失败: ${error.message || '网络错误'}`);
                    set({ isPolling: false });
                    throw error;
                }
            },

            stopLoginProcess: () => {
                const { _pollTimer } = get();
                if (_pollTimer) clearInterval(_pollTimer);
                set({ isPolling: false, loginUrl: null, encodedNonce: null, _pollTimer: null });
            },

            checkPolling: async () => {
                const { encodedNonce, isPolling } = get();
                if (!isPolling || !encodedNonce) return false;

                try {
                    const token = await AuthService.pollTokenOnce(encodedNonce);
                    if (token) {
                        // Success!
                        set({ token, isLoggedIn: true, isLoginModalVisible: false }); // Close modal on success
                        message.success('登录成功');

                        // Fetch user info immediately
                        const info = await AuthService.getUserInfo(token);
                        if (info) {
                            set({ userInfo: info });
                        }
                        return true;
                    }
                } catch (error) {
                    // Polling errors are usually transient or ignored until timeout
                    return false;
                }
                return false;
            },

            logout: async () => {
                const { token } = get();
                if (token) {
                    try {
                        await AuthService.logout(token);
                        message.info('已退出登录');
                    } catch (e) {
                        // Logout error can be ignored locally
                    }
                }
                set({ token: null, userInfo: null, isLoggedIn: false });
            },

            setUserInfo: (info) => set({ userInfo: info }),

            init: async () => {
                const { token } = get();
                if (token) {
                    const valid = await AuthService.checkLogin(token);
                    if (valid) {
                        const info = await AuthService.getUserInfo(token);
                        if (info) set({ userInfo: info, isLoggedIn: true });
                    } else {
                        set({ token: null, isLoggedIn: false, userInfo: null });
                    }
                }
            }
        }),
        {
            name: 'user-storage',
            partialize: (state) => ({ token: state.token, userInfo: state.userInfo, isLoggedIn: state.isLoggedIn }), // Persist only these
        }
    )
);
