转换通知规则脚本方案
====================

一、目标与范围
--------------

1. 统一所有“转换类”工具在以下场景下的用户提示表现形式：
   - 转换开始
   - 转换成功
   - 转换失败（后端报错或异常）
   - 转换被用户取消且清理了目标文件
2. 废弃顶部左上角的轻量文字提示（notification-quarter），改为统一使用模态提示框（AlertModal / ConfirmationModal）承载转换相关提示。
3. 不改变现有业务流程及后端调用逻辑，只收敛“提示样式”和“触发时机”。
4. 已经按新规范实现的模块（如 WEBMToMP4GUI）作为对照样例，其行为视为目标设计。

二、现状梳理（摘要）
------------------

1. 顶部提示实现方式
   - 多数 GUI 组件内部维护 notification 状态并在根容器内渲染 class = notification-quarter 的提示文案。
   - 通常用于：
     - 转换成功：例如“转换成功，已保存到 …”
     - 取消成功：例如“已取消转换并删除本地文件”。
   - 该方式与 AlertModal 共存，导致同一操作出现双重提示。

2. 模态提示实现方式
   - 在 SharedUI 中提供 AlertModal、ConfirmationModal 组件。
   - WEBMToMP4GUI 已使用 AlertModal 作为“任务完成”、“任务取消”等提示的唯一载体。

3. 问题点
   - 提示样式不统一；部分模块顶部提示，部分模块模态弹窗。
   - 顶部提示在批量任务场景下会快速闪烁，体验不佳。
   - 顶部提示与模态提示信息重复，增加用户认知负担。

三、规则脚本设计
----------------

1. 规则脚本位置
   - 新增前端规则脚本文件：
     - frontend/src/rules/conversionNotificationRules.js
   - 文件职责：
     - 定义统一的“转换提示场景枚举”与“提示策略”。
     - 为各 GUI 提供调用接口（例如统一的 showConversionAlert 辅助函数）。

2. 关键概念与枚举
   - ConversionScenario（转换场景枚举）：
     - START：开始转换（通常不弹窗，只用于内部统计或后续扩展）。
     - SUCCESS_SINGLE：单个文件转换成功。
     - SUCCESS_BATCH_ALL：批量任务全部完成。
     - ERROR_SINGLE：单个文件转换失败。
     - ERROR_BATCH_ABORTED：批量任务中途因错误中断。
     - CANCELLED_USER：用户主动取消任务并清理相关文件。
   - ConversionChannel（提示通道枚举）：
     - MODAL_ALERT：使用 AlertModal 展示。
     - NONE：不直接提示，由其它 UI（进度条等）承担反馈。

3. 规则定义结构（描述）
   - 规则脚本内部维护一个“场景 → 策略”的静态映射，包含：
     - scene：ConversionScenario 枚举值。
     - channel：ConversionChannel 枚举值。
     - defaultTitle：默认标题文案（如“完成”、“错误”、“已取消”等）。
     - defaultMessage：默认内容文案，可包含占位符（如 {fileName}、{outputDir}）。
     - allowCustomMessage：布尔值，表示调用方是否可以传入更详细的 message。
   - WEBMToMP4GUI 当前行为映射到：
     - CANCELLED_USER -> MODAL_ALERT，标题“已取消”，内容“转换任务已取消，相关文件已清理。”。
     - SUCCESS_BATCH_ALL -> MODAL_ALERT，标题“完成”，内容“所有任务处理完成！”。 

4. 统一调用接口（描述）
   - 规则脚本导出一个主函数（示例命名）：
     - applyConversionNotificationRule(context)
   - 参数 context 包含字段：
     - scene：当前场景（ConversionScenario）。
     - ui：当前页面持有的 UI 控制能力集合，至少包含：
       - showAlert(title, message, onConfirm, buttonText, onClose)
       - optional：setNotification(message)（用于向后兼容极少数需要顶部提示的场景，如非转换类短提示）。
     - data：场景相关数据：
       - filePath / fileName
       - outputDir
       - errorMessage
       - totalCount / finishedCount
   - 函数内部根据规则表：
     - 选取对应场景的策略。
     - 组合最终 title 与 message（优先 data 中传入的自定义文案，其次使用 defaultMessage 并进行占位符替换）。
     - 按策略调用 UI 通道：
       - 对于 MODAL_ALERT：调用 ui.showAlert。
       - 对于 NONE：不做任何提示。

四、组件改造规则
----------------

1. 顶部提示禁用范围
   - 所有“视频/音频/GIF 转换”相关 GUI 中：
     - 转换成功提示不得再使用 notification-quarter。
     - 转换取消提示不得再使用 notification-quarter。
   - 顶部提示仅保留在以下场景（如确有需要时使用本规则脚本外的本地逻辑）：
     - 非长耗时操作的轻量提示（例如参数校验、Web 模式限制说明）。
     - 与“转换任务”无直接关系的提示。

2. GUI 组件中替换策略
   - 统一为每个 GUI 组件定义 showAlert 封装，并在组件内部保留 alertModal 状态管理。
   - 原有直接调用 setNotification 的转换成功/取消逻辑，改为：
     - 构造 context（包含 scene、ui、data）。
     - 调用 applyConversionNotificationRule。
   - WEBMToMP4GUI：
     - 目前已使用 AlertModal 作为完成与取消提示，需要做以下对齐：
       - 将硬编码的 showAlert("完成", "...") 与 showAlert("已取消", "...") 替换为调用规则脚本函数。
       - 保留交互与文案不变，只是通过规则脚本统一管理。
   - GIF 模块 GUI（例如 GIFToMP4GUI、GIFToMOVGUI 等）：
     - 删除或废弃转换成功/取消相关的 notification-quarter 调用。
     - 在对应时代码位置使用规则脚本进行模态提示。

3. 错误场景处理规则
   - 对于后端 convert 返回 success = false 的情况：
     - 统一使用 scene = ERROR_SINGLE。
     - 默认规则：
       - channel = MODAL_ALERT。
       - 标题：“错误”。
       - 内容：由规则脚本拼接“转换失败: {fileName}\n{errorMessage}”。
     - GUI 可以在构造 context 时向 data.errorMessage 传入后端返回的 error 或 message。
   - 对于批量任务中途因错误中断：
     - 可选使用 scene = ERROR_BATCH_ABORTED。
     - 规则建议：
       - 标题：“部分任务失败”或“任务中断”。
       - 内容：包含已完成数量与失败原因摘要。

4. 取消场景处理规则
   - 用户点击“取消”并且后端清理文件成功后：
     - 必须使用 scene = CANCELLED_USER。
     - 默认内容与 WEBMToMP4GUI 当前提示保持一致：
       - 文案：“转换任务已取消，相关文件已清理。”。
   - 若取消请求本身失败（例如后端无法删除文件）：
     - 使用 ERROR_SINGLE 场景，提示取消失败原因。

五、实施范围与文件清单
----------------------

1. 新增文件
   - docs/conversion-notification-rules.md（本文件）。
   - frontend/src/rules/conversionNotificationRules.js（仅描述结构，不在本阶段实现）。

2. 需要改造的前端 GUI（不完全列举，实施阶段应通过搜索确认）
   - GIF 类：
     - frontend/src/tool-ui/gif/GIFToMP4GUI.jsx
     - frontend/src/tool-ui/gif/GIFToMOVGUI.jsx
     - frontend/src/tool-ui/gif/GIFToAVIGUI.jsx
     - frontend/src/tool-ui/gif/GIFToWEBMGUI.jsx
     - frontend/src/tool-ui/gif/GIFToWEBPGUI.jsx
     - 以及其它含有 notification-quarter 的 GIF 相关 GUI。
   - WEBM、MP4、MOV 等视频工具：
     - frontend/src/tool-ui/video/WEBMToMP4GUI.jsx（作为参考实现，需要改为使用规则脚本）。
     - frontend/src/tool-ui/video/WEBMToAVIGUI.jsx
     - frontend/src/tool-ui/video/WEBMToMOVGUI.jsx
     - frontend/src/tool-ui/video/WEBMToGIFGUI.jsx
     - frontend/src/tool-ui/video/MP4ToXXXGUI.jsx 系列。

3. 不在本次规则控制范围内的内容
   - 后端转换逻辑（Python converters 与 ffmpeg 调用）；仅在前端视图层进行提示统一。
   - 进度条、批量统计等已有 UI 行为保持不变。

六、与已有功能的兼容性要求
--------------------------

1. 不能改变以下行为的业务含义：
   - 转换顺序、进度计算方式。
   - 批量任务的中断条件与错误处理流程。
   - 已经修复的“0 字节文件清理”逻辑。

2. 兼容性原则
   - 在改造前后，对同一操作的“是否弹出提示”保持一致，仅改变提示的“载体位置”与“样式”。
   - 任何新引入的规则必须允许按组件逐步接入，确保未改造完之前不会造成报错。
   - 规则脚本需要提供“向后兼容模式”配置，允许在个别组件中暂时关闭规则以便 A/B 验证。

七、实施检查清单
----------------

实施检查清单:
1. 创建 frontend/src/rules/conversionNotificationRules.js 文件并按本方案定义场景、通道与规则结构（仅在执行模式下实现）。
2. 在 SharedUI 或各 GUI 中抽象统一的 showAlert 封装，确保规则脚本可以通过 ui 参数调用。
3. 在 WEBMToMP4GUI 中接入规则脚本，将完成与取消提示改为通过规则脚本触发，保证行为与当前一致。
4. 在所有包含 notification-quarter 的 GIF 工具 GUI 中，删除转换成功/取消相关的顶部提示逻辑，并改用规则脚本。
5. 在所有包含 notification-quarter 的视频工具 GUI 中，删除转换成功/取消相关的顶部提示逻辑，并改用规则脚本。
6. 为错误场景和取消场景接入统一规则，确保错误与取消提示均通过 AlertModal 展示。
7. 对所有改造后的工具进行回归测试，验证：成功、失败、取消三种路径下仅出现模态提示，无顶部文字提示残留。
8. 更新 ISSUES.md 中可能涉及提示行为的历史问题记录，将已解决项标记为已处理，并记录任何新发现的问题。
9. 完成代码审查与合并前，对 conversionNotificationRules.js 的规则进行一次集中审核，确认文案与交互符合产品预期。
10. 最终动作：在执行模式下按照本检查清单逐项完成改造，并确保 Electron 打包版与开发版的提示行为一致。
o.

