import { theme as antdTheme } from 'antd';

const LIGHT_PAGE = '#f3f4f6';
const LIGHT_CHROME = '#e5e7eb';
const LIGHT_BORDER = '#d1d5db';
const DARK_CHROME = '#0c1b33';
const DARK_BORDER = 'rgba(56, 189, 248, 0.28)';
const TAB_AMBER = '#b45309';

/** Brand tokens shared with Insights. Compact cards are opt-in via size="small", not a global token. */
export function buildAntdTheme(isLight) {
  return {
    algorithm: isLight ? antdTheme.defaultAlgorithm : antdTheme.darkAlgorithm,
    token: {
      colorPrimary: '#134178',
      borderRadius: 8,
      fontSize: 16,
      ...(isLight
        ? {
          colorBgLayout: LIGHT_PAGE,
          colorBgContainer: '#ffffff',
          colorBorder: LIGHT_BORDER,
          colorBorderSecondary: LIGHT_CHROME,
          colorText: '#111827',
          colorTextSecondary: '#6b7280',
          colorTextHeading: '#111827',
        }
        : {
          colorBgContainer: DARK_CHROME,
          colorBorder: DARK_BORDER,
          colorBorderSecondary: 'rgba(19, 65, 120, 0.55)',
          colorText: '#E5E7EB',
          colorTextSecondary: '#9CA3AF',
          colorTextHeading: '#E5E7EB',
        }),
    },
    components: {
      Layout: {
        headerBg: isLight ? LIGHT_CHROME : DARK_CHROME,
        siderBg: isLight ? LIGHT_CHROME : DARK_CHROME,
        lightSiderBg: LIGHT_CHROME,
        bodyBg: isLight ? LIGHT_PAGE : '#0B1220',
        headerHeight: 64,
      },
      Menu: isLight
        ? { itemBg: LIGHT_CHROME, subMenuItemBg: LIGHT_CHROME }
        : {},
      Tabs: {
        inkBarColor: TAB_AMBER,
        itemSelectedColor: TAB_AMBER,
        itemHoverColor: '#d97706',
      },
      Input: isLight
        ? {
          colorBgContainer: '#f9fafb',
          activeBg: '#ffffff',
          hoverBg: '#f9fafb',
        }
        : {
          colorBgContainer: '#111A2C',
          activeBg: '#111A2C',
          hoverBg: '#111A2C',
        },
    },
  };
}

export function shellBorderColor(isLight) {
  return isLight ? LIGHT_BORDER : DARK_BORDER;
}
