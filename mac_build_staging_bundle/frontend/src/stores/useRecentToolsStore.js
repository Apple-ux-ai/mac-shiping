import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useRecentToolsStore = create(
  persist(
    (set) => ({
      recentTools: [], // 存储工具名称字符串数组，如 ['AVI To MP4', 'GIF To WEBM']
      
      addTool: (toolName) => set((state) => {
        // 移除已存在的同名工具
        const filtered = state.recentTools.filter((name) => name !== toolName);
        // 将新工具插入头部，并截取前 8 个
        const newTools = [toolName, ...filtered].slice(0, 8);
        return { recentTools: newTools };
      }),

      removeTool: (toolName) => set((state) => {
        const newTools = state.recentTools.filter((name) => name !== toolName);
        return { recentTools: newTools };
      }),
      
      clearTools: () => set({ recentTools: [] }),
    }),
    {
      name: 'recent-tools-storage', // localStorage key
    }
  )
);
