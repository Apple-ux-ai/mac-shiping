# 面包屑导航修改计划：移除“首页”选项

## 1. 概述
当前项目中，所有功能界面的面包屑导航（Breadcrumb）首项均为“首页”。为了简化导航并聚焦当前业务路径，计划移除该选项，使面包屑直接从分类名（如“AVI 转换器”）开始。

## 2. 修改范围
- **公共组件**：`frontend/src/tool-ui/common/SharedUI.jsx`
- **功能页面**：
    - AVI 转换器相关页面 (`frontend/src/tool-ui/video/AVITo*GUI.jsx`)
    - GIF 转换器相关页面 (`frontend/src/tool-ui/gif/GIFTo*GUI.jsx`)
    - WebM 转换器相关页面 (`frontend/src/tool-ui/video/WEBMTo*GUI.jsx`)
    - MOV 转换器相关页面 (`frontend/src/tool-ui/video/MOVTo*GUI.jsx`)
    - MP4 转换器相关页面 (`frontend/src/tool-ui/video/MP4To*GUI.jsx`)

## 3. 执行顺序与详细步骤

### 第一阶段：修改公共 UI 组件
修改 `SharedUI.jsx` 中的 `ToolBreadcrumbs` 和 `UnifiedToolHeader` 组件。
- 移除硬编码的 `<a onClick={() => navigate('/')}>首页</a>`。
- 移除紧随其后的分隔符 `<span>/</span>` 或相关逻辑。
- 确保当 `items` 为空或只有一个元素时，显示效果依然正常。

### 第二阶段：修改 AVI 转换器 (AVI Converters)
遍历并修改 `frontend/src/tool-ui/video/` 目录下所有 `AVITo*GUI.jsx` 文件。
- 查找 `className="tool-breadcrumbs"` 的 div。
- 移除“首页”链接及其后的斜杠 `/`。
- **目标文件列表**：`AVIToMP4GUI.jsx`, `AVIToMKVGUI.jsx`, `AVIToMOVGUI.jsx`, `AVIToGIFGUI.jsx`, 等。

### 第三阶段：修改 GIF 转换器 (GIF Converters)
遍历并修改 `frontend/src/tool-ui/gif/` 目录下所有 `GIFTo*GUI.jsx` 文件。
- 移除面包屑中的“首页”项。
- **目标文件列表**：`GIFToMP4GUI.jsx`, `GIFToAVIGUI.jsx`, `GIFToWEBMGUI.jsx`, `GIFToJPGGUI.jsx`, `GIFToPNGGUI.jsx`, 等。

### 第四阶段：修改 WebM 转换器 (WebM Converters)
遍历并修改 `frontend/src/tool-ui/video/` 目录下所有 `WEBMTo*GUI.jsx` 文件。
- 移除面包屑中的“首页”项。
- **目标文件列表**：`WEBMToMP4GUI.jsx`, `WEBMToAVIGUI.jsx`, `WEBMToGIFGUI.jsx`, 等。

### 第五阶段：修改 MOV 转换器 (MOV Converters)
遍历并修改 `frontend/src/tool-ui/video/` 目录下所有 `MOVTo*GUI.jsx` 文件。
- 移除面包屑中的“首页”项。
- **目标文件列表**：`MOVToMP4GUI.jsx`, `MOVToAVIGUI.jsx`, `MOVToGIFGUI.jsx`, 等。

### 第六阶段：修改 MP4 转换器 (MP4 Converters)
遍历并修改 `frontend/src/tool-ui/video/` 目录下所有 `MP4To*GUI.jsx` 文件。
- 移除面包屑中的“首页”项。
- **目标文件列表**：`MP4ToWEBMGUI.jsx`, `MP4ToAVIGUI.jsx`, `MP4ToGIFGUI.jsx`, 等。

## 4. 验收标准
- 进入任一具体转换功能页面，面包屑导航起始项应为分类名。
- 面包屑中的分类名（如“AVI 转换器”）点击后应能正确返回分类列表页。
- 页面整体视觉布局无错位，分隔符显示正确。
