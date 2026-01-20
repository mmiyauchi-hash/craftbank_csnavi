import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { 
    path: '/prep', 
    label: '商談準備', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  { 
    path: '/', 
    label: '録音・分析', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  { 
    path: '/projects', 
    label: '案件管理', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
];

const adminItems = [
  { 
    path: '/admin', 
    label: '設定', 
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function Sidebar() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside 
      className="w-56 border-r flex flex-col"
      style={{ 
        backgroundColor: 'var(--cb-sidebar-bg)',
        borderColor: 'var(--cb-border)',
      }}
    >
      {/* メインナビゲーション */}
      <nav className="flex-1 py-4">
        <div className="px-4 mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--cb-text-secondary)' }}>
            メニュー
          </span>
        </div>
        <ul className="space-y-1 px-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.path)
                    ? 'text-green-700'
                    : 'hover:bg-gray-100'
                }`}
                style={{
                  backgroundColor: isActive(item.path) ? 'var(--cb-sidebar-active)' : undefined,
                  color: isActive(item.path) ? 'var(--cb-primary)' : 'var(--cb-text-primary)',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* 管理セクション */}
        <div className="px-4 mt-6 mb-2">
          <span className="text-xs font-medium" style={{ color: 'var(--cb-text-secondary)' }}>
            管理
          </span>
        </div>
        <ul className="space-y-1 px-2">
          {adminItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.path)
                    ? 'text-green-700'
                    : 'hover:bg-gray-100'
                }`}
                style={{
                  backgroundColor: isActive(item.path) ? 'var(--cb-sidebar-active)' : undefined,
                  color: isActive(item.path) ? 'var(--cb-primary)' : 'var(--cb-text-primary)',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* フッター情報 */}
      <div 
        className="p-4 border-t text-xs"
        style={{ 
          borderColor: 'var(--cb-border)',
          color: 'var(--cb-text-secondary)',
        }}
      >
        <p className="mb-1">AI Navigation PoC</p>
        <p className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          ローカル処理
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
