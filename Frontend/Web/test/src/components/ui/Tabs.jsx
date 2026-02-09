import { useState, createContext, useContext, useRef, useLayoutEffect } from 'react';

const TabsContext = createContext();

export function Tabs({ defaultValue, children, className = '' }) {
  const [activeTab, setActiveTab] = useState(defaultValue);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [listEl, setListEl] = useState(null);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab, indicatorStyle, setIndicatorStyle, listEl, setListEl }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = '' }) {
  const { indicatorStyle, setListEl } = useContext(TabsContext);

  return (
    <div
      ref={setListEl}
      className={`relative inline-flex h-10 items-center justify-center rounded-lg bg-background/60 p-1 border border-border transition-colors duration-300 ease-in-out ${className}`}
    >
      {/* Sliding background indicator */}
      <div
        className="absolute top-1 left-1 h-[calc(100%-8px)] rounded-md bg-card shadow-card border border-border pointer-events-none"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          transition: 'left 300ms ease-in-out, width 300ms ease-in-out',
        }}
      />
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = '' }) {
  const { activeTab, setActiveTab, setIndicatorStyle, listEl } = useContext(TabsContext);
  const triggerRef = useRef(null);
  const isActive = activeTab === value;

  useLayoutEffect(() => {
    if (!isActive || !triggerRef.current || !listEl) return;
    const listRect = listEl.getBoundingClientRect();
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const left = triggerRect.left - listRect.left - (listEl.clientLeft || 0);
    setIndicatorStyle({
      left,
      width: triggerRect.width,
    });
  }, [isActive, listEl, setIndicatorStyle]);

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setActiveTab(value)}
      className={`relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background transition-colors duration-300 ease-in-out ${
        isActive
          ? 'text-foreground'
          : 'text-muted hover:text-foreground hover:bg-card/50'
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className = '' }) {
  const { activeTab } = useContext(TabsContext);
  
  if (activeTab !== value) return null;

  return (
    <div className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
}
