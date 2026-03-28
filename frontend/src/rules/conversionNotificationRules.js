export const ConversionScenario = {
  START: 'START',
  SUCCESS_SINGLE: 'SUCCESS_SINGLE',
  SUCCESS_BATCH_ALL: 'SUCCESS_BATCH_ALL',
  ERROR_SINGLE: 'ERROR_SINGLE',
  ERROR_BATCH_ABORTED: 'ERROR_BATCH_ABORTED',
  CANCELLED_USER: 'CANCELLED_USER'
};

export const ConversionChannel = {
  MODAL_ALERT: 'MODAL_ALERT',
  NONE: 'NONE'
};

const rules = {
  [ConversionScenario.SUCCESS_BATCH_ALL]: {
    channel: ConversionChannel.MODAL_ALERT,
    defaultTitle: '完成',
    defaultMessage: '所有任务处理完成！可在结果区域单独下载，或使用“下载批量结果”一次获取打包文件。',
    defaultButtonText: '确定',
    allowCustomMessage: true
  },
  [ConversionScenario.ERROR_SINGLE]: {
    channel: ConversionChannel.MODAL_ALERT,
    defaultTitle: '错误',
    defaultMessage: '转换失败: {fileName}\n{errorMessage}',
    defaultButtonText: '确定',
    allowCustomMessage: true
  },
  [ConversionScenario.ERROR_BATCH_ABORTED]: {
    channel: ConversionChannel.MODAL_ALERT,
    defaultTitle: '任务中断',
    defaultMessage: '部分文件转换失败，已完成 {finishedCount}/{totalCount} 个。',
    defaultButtonText: '确定',
    allowCustomMessage: true
  },
  [ConversionScenario.CANCELLED_USER]: {
    channel: ConversionChannel.MODAL_ALERT,
    defaultTitle: '已取消',
    defaultMessage: '转换任务已取消，相关文件已清理。',
    defaultButtonText: '确定',
    allowCustomMessage: true
  }
};

function formatTemplate(template, data) {
  if (!template) return '';
  const map = data || {};
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = map[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function applyConversionNotificationRule(context) {
  if (!context) return;
  const { scene, ui, data } = context;
  if (!scene || !ui || typeof ui.showAlert !== 'function') return;
  const rule = rules[scene];
  if (!rule) return;
  const channel = rule.channel || ConversionChannel.NONE;
  if (channel === ConversionChannel.NONE) return;
  const payload = data || {};
  const filePath = payload.filePath || '';
  const fileName = payload.fileName || (filePath ? filePath.split(/[\\/]/).pop() : '');
  const title = payload.customTitle || rule.defaultTitle || '';
  let message;
  if (rule.allowCustomMessage && payload.customMessage) {
    message = payload.customMessage;
  } else {
    const templateData = {
      fileName,
      outputDir: payload.outputDir,
      errorMessage: payload.errorMessage,
      totalCount: payload.totalCount,
      finishedCount: payload.finishedCount
    };
    message = formatTemplate(rule.defaultMessage, templateData);
  }
  const onConfirm = payload.onConfirm;
  const buttonText = payload.buttonText || rule.defaultButtonText || '确定';
  const onClose = payload.onClose;
  if (channel === ConversionChannel.MODAL_ALERT) {
    ui.showAlert(title, message, onConfirm, buttonText, onClose);
  }
}
