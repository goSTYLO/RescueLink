import { useMemo } from 'react';
import { App, ConfigProvider } from 'antd';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { AntdFeedbackBridge } from '@/presentation/feedback/alertUser';
import { buildAntdTheme } from '@/presentation/theme/antdTheme';

export function AntdProvider({ children }) {
  const { theme } = useTheme();
  const antdTheme = useMemo(() => buildAntdTheme(theme === 'light'), [theme]);

  return (
    <ConfigProvider theme={antdTheme}>
      <App>
        <AntdFeedbackBridge />
        {children}
      </App>
    </ConfigProvider>
  );
}
