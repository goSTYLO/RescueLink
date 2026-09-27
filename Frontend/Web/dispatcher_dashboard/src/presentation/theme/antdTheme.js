import { theme as antdTheme } from 'antd';

const LIGHT_PAGE = '#e5e7eb';
const LIGHT_CARD = '#eef0f3';
const LIGHT_INPUT = '#e8eaed';
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
          colorBgContainer: LIGHT_CARD,
          colorBgElevated: LIGHT_CARD,
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
          colorBgContainer: LIGHT_INPUT,
          activeBg: LIGHT_CARD,
          hoverBg: LIGHT_INPUT,
        }
        : {
          colorBgContainer: '#111A2C',
          activeBg: '#111A2C',
          hoverBg: '#111A2C',
        },
      Card: {
        borderRadius: 4,
        borderRadiusLG: 4,
      },
      Tag: {
        borderRadiusSM: 4,
      },
    },
  };
}

export function shellBorderColor(isLight) {
  return isLight ? LIGHT_BORDER : DARK_BORDER;
}
