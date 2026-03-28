import { useThemeStore } from '../stores/useThemeStore';
import { useEffect } from 'react';

const updateDomTheme = (theme) => {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.setAttribute('data-theme', 'dark');
    } else {
        root.removeAttribute('data-theme');
    }
};

export const useTheme = () => {
    const { theme, setTheme } = useThemeStore();

    useEffect(() => {
        // Sync DOM on mount/update (in case it wasn't set yet)
        updateDomTheme(theme);
    }, [theme]);

    const toggleTheme = async (event) => {
        const newTheme = theme === 'light' ? 'dark' : 'light';

        // Fallback for browsers without View Transition API support
        if (!document.startViewTransition) {
            setTheme(newTheme);
            updateDomTheme(newTheme);
            return;
        }

        // Get click coordinates or default to center
        const x = event?.clientX ?? window.innerWidth / 2;
        const y = event?.clientY ?? window.innerHeight / 2;

        // Calculate the radius needed to cover the screen from the click point
        const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y)
        );

        // Start View Transition
        const transition = document.startViewTransition(() => {
            // Manually update the DOM immediately for the snapshot
            updateDomTheme(newTheme);
            // Trigger React state update to keep sync
            setTheme(newTheme);
        });

        // Wait for pseudo-elements to be created
        await transition.ready;

        // Custom Circle Clip Animation
        // Always expand the new view from the click point to cover the screen
        const clipPath = [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
        ];

        document.documentElement.animate(
            {
                clipPath: clipPath,
            },
            {
                duration: 700,
                easing: 'cubic-bezier(0.23, 1, 0.32, 1)', // iOS-like smooth deceleration
                pseudoElement: '::view-transition-new(root)',
            }
        );
    };

    return { theme, toggleTheme };
};
