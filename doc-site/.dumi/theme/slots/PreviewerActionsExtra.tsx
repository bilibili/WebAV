// 使用默认 SourceCode，避免 dumi-theme-antd-style 主题覆盖
// 否则会在 源码下方引入不生效的 【亮色/暗色模式】 Icon

// @ts-nocheck
import PreviewerActionsExtra from 'dumi/theme-default/slots/PreviewerActionsExtra';

export default (props) => {
  return <PreviewerActionsExtra {...props}></PreviewerActionsExtra>;
};
