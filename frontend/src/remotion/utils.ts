/**
 * 视频渲染工具函数
 *
 * 功能模块：
 * - 颜色转换：hexToRgba（十六进制转 RGBA）
 * - 亮度计算：getLuminance（计算相对亮度）
 * - 对比度文字：getContrastText（自动选择黑/白文字）
 * - 按钮文字颜色：getButtonTextColor（处理渐变背景的文字颜色）
 * - 高对比度检测：isHighContrastGradient（检测黑白等高对比渐变）
 * - 图片定位：getObjectPosition（将 focusArea 转换为 CSS object-position）
 */

/**
 * 十六进制颜色转 RGBA
 *
 * @param hex - 十六进制颜色值，如 "#9b4dff" 或 "9b4dff"
 * @param alpha - 透明度，0~1，默认为 1（完全不透明）
 * @returns RGBA 颜色字符串，如 "rgba(155, 77, 255, 1)"
 *
 * @example
 * hexToRgba('#9b4dff')       // 'rgba(155, 77, 255, 1)'
 * hexToRgba('#9b4dff', 0.5)  // 'rgba(155, 77, 255, 0.5)'
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  // 正则匹配 6 位十六进制颜色（支持带/不带 # 前缀）
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    // 分别解析 R、G、B 通道的十六进制值
    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
  }
  // 解析失败时返回原值（容错处理）
  return hex;
}

/**
 * 计算颜色的相对亮度
 *
 * 使用 ITU-R BT.601 标准加权公式：
 * Luminance = 0.299 * R + 0.587 * G + 0.114 * B
 *
 * 人眼对绿色最敏感（权重 0.587），红色次之（0.299），蓝色最低（0.114）
 *
 * @param hex - 十六进制颜色值
 * @returns 亮度值，范围 0~255（0=最暗，255=最亮）
 *
 * @example
 * getLuminance('#000000')  // 0（纯黑）
 * getLuminance('#FFFFFF')  // 255（纯白）
 * getLuminance('#9b4dff')  // ~110（紫色，中等亮度）
 */
export function getLuminance(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 128; // 解析失败时返回中等亮度
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  // ITU-R BT.601 亮度公式
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 根据背景亮度自动选择对比文字颜色
 *
 * 原理：背景亮时用黑字，背景暗时用白字
 * 阈值 128 是经验值，在亮度中点附近
 *
 * @param bgHex - 背景颜色的十六进制值
 * @returns '#000000'（黑色）或 '#FFFFFF'（白色）
 *
 * @example
 * getContrastText('#FFFFFF')  // '#000000'（白底用黑字）
 * getContrastText('#000000')  // '#FFFFFF'（黑底用白字）
 */
export function getContrastText(bgHex: string): string {
  const luminance = getLuminance(bgHex);
  // 亮度 > 128 认为是亮色背景，使用黑字
  return luminance > 128 ? '#000000' : '#FFFFFF';
}

/**
 * 计算按钮渐变背景上的文字颜色
 *
 * 处理两种情况：
 * 1. 高对比度渐变（如黑白渐变）：使用黑色文字 + 阴影增强可读性
 * 2. 普通渐变：根据平均亮度选择黑/白文字
 *
 * @param primary - 渐变起始色
 * @param secondary - 渐变结束色
 * @returns 文字颜色 '#000000' 或 '#FFFFFF'
 *
 * @example
 * getButtonTextColor('#000000', '#FFFFFF')  // '#000000'（黑白渐变用黑字）
 * getButtonTextColor('#9b4dff', '#6b21a8')  // '#FFFFFF'（紫色渐变用白字）
 */
export function getButtonTextColor(primary: string, secondary: string): string {
  const lum1 = getLuminance(primary);
  const lum2 = getLuminance(secondary);
  const avgLuminance = (lum1 + lum2) / 2;

  // 高对比度渐变（亮度差 > 200）：强制使用黑色文字
  // 这类渐变需要配合 textShadow 使用，否则文字难以阅读
  if (Math.abs(lum1 - lum2) > 200) {
    return '#000000';
  }

  // 普通渐变：根据平均亮度决定
  return avgLuminance > 128 ? '#000000' : '#FFFFFF';
}

/**
 * 检测是否为高对比度渐变
 *
 * 高对比度渐变（如黑白、深蓝到白色）需要特殊的文字阴影处理
 *
 * @param primary - 渐变起始色
 * @param secondary - 渐变结束色
 * @returns true 如果两色亮度差超过 200
 *
 * @example
 * isHighContrastGradient('#000000', '#FFFFFF')  // true（黑白渐变）
 * isHighContrastGradient('#9b4dff', '#6b21a8')  // false（紫色渐变）
 */
export function isHighContrastGradient(primary: string, secondary: string): boolean {
  const lum1 = getLuminance(primary);
  const lum2 = getLuminance(secondary);
  // 亮度差 > 200 认为是高对比度
  return Math.abs(lum1 - lum2) > 200;
}

/**
 * 将 focusArea 配置转换为 CSS object-position 值
 *
 * 用于控制图片在容器中的焦点位置
 * 配合 object-fit: cover 使用时，可确保图片的重要部分始终可见
 *
 * @param focusArea - 焦点区域：'top' | 'bottom' | 'left' | 'right' | 'center'
 * @returns CSS object-position 值
 *
 * @example
 * getObjectPosition('top')     // 'center top'（图片顶部居中）
 * getObjectPosition('bottom')  // 'center bottom'（图片底部居中）
 * getObjectPosition('left')    // 'left center'（图片左侧居中）
 */
export function getObjectPosition(focusArea: string): string {
  switch (focusArea) {
    case 'top': return 'center top';
    case 'bottom': return 'center bottom';
    case 'left': return 'left center';
    case 'right': return 'right center';
    case 'center':
    default: return 'center center';
  }
}
