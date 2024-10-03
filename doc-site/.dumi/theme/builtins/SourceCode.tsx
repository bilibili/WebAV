// 使用默认 SourceCode，避免 dumi-theme-antd-style 主题覆盖
// 否则会导致闪烁

// @ts-nocheck
import SourceCode from 'dumi/theme-default/builtins/SourceCode';
export default (props) => {
  return <SourceCode {...props}  />;
};
