# Refactoring Plan: Unifying Conversion Notifications (Phase 2)

## 1. Goal
Complete the unification of conversion-related alerts by removing deprecated `notification-quarter` elements and integrating `applyConversionNotificationRule` in remaining GUI tools.

## 2. Target Files
### GIF Tools (Remaining Refactoring/Cleanup)
- `frontend/src/tool-ui/gif/GIFToHTMLGUI.jsx` (Full Refactor)
- `frontend/src/tool-ui/gif/GIFToPDFGUI.jsx` (Cleanup UI/Function)
- `frontend/src/tool-ui/gif/GIFToPNGGUI.jsx` (Cleanup Function)
- `frontend/src/tool-ui/gif/GIFToAVIGUI.jsx` (Cleanup Function/Usage)
- `frontend/src/tool-ui/gif/GIFToMP4GUI.jsx` (Cleanup Function)
- `frontend/src/tool-ui/gif/GIFToJPGGUI.jsx` (Cleanup State)
- `frontend/src/tool-ui/gif/GIFToBase64GUI.jsx` (Cleanup State)
- `frontend/src/tool-ui/gif/GIFToMOVGUI.jsx` (Cleanup State)
- `frontend/src/tool-ui/gif/GIFToWEBMGUI.jsx` (Cleanup State)
- `frontend/src/tool-ui/gif/GIFToWEBPGUI.jsx` (Cleanup State)

### Video Tools (Refactoring/Cleanup)
- `frontend/src/tool-ui/video/MP4ToAVIGUI.jsx` (Full Refactor)
- `frontend/src/tool-ui/video/WEBMToMP4GUI.jsx` (Cleanup Function)

## 3. Implementation Details
### For "Full Refactor" Files (`GIFToHTMLGUI.jsx`, `MP4ToAVIGUI.jsx`):
1.  **Imports**: Add `import { applyConversionNotificationRule, ConversionScenario } from '../../rules/conversionNotificationRules';`.
2.  **State**: Remove `const [notification, setNotification] = useState(null);`.
3.  **Functions**: Delete `showNotification` helper function.
4.  **Conversion Success**: Replace `showAlert` and `showNotification` calls in `handleConvert` with `applyConversionNotificationRule({ scene: ConversionScenario.SUCCESS_BATCH_ALL, ... })`.
5.  **Conversion Error**: Replace direct `showAlert` calls in `handleConvert` or `catch` blocks with `applyConversionNotificationRule({ scene: ConversionScenario.ERROR_SINGLE, ... })`.
6.  **Conversion Cancellation**: Replace `showNotification` or `showAlert` in `confirmCancel` with `applyConversionNotificationRule({ scene: ConversionScenario.CANCELLED_USER, ... })`.
7.  **UI**: Remove `{notification && <div className="notification-quarter">{notification}</div>}` from the `return` statement.

### For "Cleanup" Files:
1.  Remove unused `notification` state.
2.  Remove unused `showNotification` function.
3.  Remove `notification-quarter` UI if present.
4.  Ensure `applyConversionNotificationRule` is used for all conversion events.

## 4. Implementation Checklist
实施检查清单:
1. 重构 `frontend/src/tool-ui/gif/GIFToHTMLGUI.jsx`，移除 notification-quarter 并接入规则脚本。
2. 重构 `frontend/src/tool-ui/video/MP4ToAVIGUI.jsx`，移除 notification-quarter 并接入规则脚本。
3. 清理 `frontend/src/tool-ui/gif/GIFToPDFGUI.jsx` 中的 notification 逻辑。
4. 清理 `frontend/src/tool-ui/gif/GIFToPNGGUI.jsx` 中的 notification 逻辑。
5. 清理 `frontend/src/tool-ui/video/WEBMToMP4GUI.jsx` 中的 notification 逻辑。
6. 对所有 GIF 剩余文件（JPG, MOV, WEBM, WEBP, Base64, AVIGUI, MP4GUI）进行最终状态清理。
7. 验证所有重构文件的提示行为。
8. o.

## 5. Final Action
Execute the batch refactoring using `SearchReplace`.
