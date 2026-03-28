# 项目开发指南

简单、高效的桌面端文件格式转换工具集。

## 技术栈说明

本项目需采用以下主流技术栈构建：

-   **外壳框架**：[Electron](https://www.electronjs.org/) (负责跨平台桌面环境支持与打包)
-   **前端界面**：[React](https://reactjs.org/) + [Vite](https://vitejs.dev/) (提供极速的开发体验与响应式 UI)
-   **后端逻辑**：[Python](https://www.python.org/) (处理高性能的文件转换、算法与核心业务逻辑)

## 项目架构

本项目采用前后端分离的 Electron 架构：

- **frontend/**: React 前端项目，负责 UI 界面。
- **backend/**: Python 后端项目，负责核心转换逻辑。
- **electron/**: Electron 主进程代码，负责窗口管理和系统交互。
- **release/**: 打包输出目录。

## 开发指南

### 启动 Web 版

在项目根目录运行：

```bash
python -m pip install -r backend/requirements-web.txt
npm install
npm run dev:web
```

启动后可在浏览器中访问：

- 前端：`http://localhost:5173`
- 后端：`http://127.0.0.1:8000`

### 安装依赖

在项目根目录运行：

```bash
npm install
```

### 启动开发环境

一键启动 React 开发服务器和 Electron 窗口（支持热重载）：

```bash
npm run dev
```

此命令会并行运行：
- 前端：`http://localhost:5173`
- Electron：加载上述 URL

### 打包发布

一键构建前端、后端（预留）并打包成 Windows 可执行文件：

```bash
npm run build
```

此命令会执行以下步骤：
1.  **构建前端**：编译 React 代码到 `frontend/dist`。
2.  **构建后端**：(TODO) 编译 Python 代码到可执行文件。
3.  **Electron 打包**：将上述产物打包为安装包和便携版。

打包产物将输出到 `release/<版本号>/` 目录，结构如下：
- `installer/`: 安装版 (`.exe`)
- `portable/`: 便携版 (`.exe`)

## 版本号管理

本项目提供了快捷命令来更新版本号（会自动修改 `package.json`）：

注意：必须先提交所有变更到 Git 仓库，才能更新版本号，否则会报错。

- **补丁版本 (Patch)**: `1.0.0` -> `1.0.1`
    ```bash
    npm run version:patch
    ```
- **次版本 (Minor)**: `1.0.0` -> `1.1.0`
    ```bash
    npm run version:minor
    ```
- **主版本 (Major)**: `1.0.0` -> `2.0.0`
    ```bash
    npm run version:major
    ```

更新版本号后，请运行 `npm run build` 生成对应版本的新安装包。

## 协作指南 (Collaboration Guide)

本项目采用分模块开发模式，不同的分类工具由不同的开发人员维护。请根据您负责的分类修改对应的页面文件。

### 目录结构

- `src/pages/VideoTools.jsx` - **视频类**工具页面逻辑
- `src/pages/ImageTools.jsx` - **图片类**工具页面逻辑
- `src/pages/DocTools.jsx` - **文档类**工具页面逻辑
- `src/pages/AudioTools.jsx` - **音频类**工具页面逻辑

### 公共组件

为了保持界面风格统一，请勿随意修改以下公共组件，除非有全局性的 UI 变更需求：

- `src/components/ToolHeader.jsx` - 顶部导航栏（包含 Logo、返回键、登录）
- `src/components/ToolSidebar.jsx` - 侧边栏（包含工具列表、底部广告）

### 数据源

- `src/data.js` - 定义了所有分类和子工具的数据结构。如果需要新增工具，请先更新此文件。

## 相关接口与示例

在 `examples/` 目录下存放了项目相关的接口文档和示例代码，供开发人员参考：

- **[授权码功能接入说明.md](file:///e:/Projects/demo/examples/授权码功能接入说明.md)**: 详细说明了如何获取授权码、验证授权码以及授权弹窗的 UI 规范。
- **[接口文档.md](file:///e:/Projects/demo/examples/接口文档.md)**: 包含登录功能、授权码验证等核心接口的详细说明（提供在线地址与本地离线版）。
- **[授权码接入示例代码.py](file:///e:/Projects/demo/examples/授权码接入示例代码.py)**: 提供了 Python 语言下的授权码接入示例逻辑，方便后端集成。
