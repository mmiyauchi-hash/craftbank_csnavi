import { Link } from 'react-router-dom';

function Header() {
  return (
    <header 
      className="h-14 border-b flex items-center justify-between px-4"
      style={{ 
        backgroundColor: 'var(--cb-bg-card)',
        borderColor: 'var(--cb-border)',
      }}
    >
      {/* ロゴ */}
      <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white"
          style={{ backgroundColor: 'var(--cb-primary)' }}
        >
          CB
        </div>
        <div>
          <h1 
            className="font-bold text-sm leading-tight"
            style={{ color: 'var(--cb-text-primary)' }}
          >
            AI Navigation
          </h1>
          <p 
            className="text-xs"
            style={{ color: 'var(--cb-text-secondary)' }}
          >
            商談支援システム
          </p>
        </div>
      </Link>

      {/* 右側コンテンツ */}
      <div className="flex items-center gap-4">
        <StatusIndicator />
        <UserMenu />
      </div>
    </header>
  );
}

function StatusIndicator() {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const isConfigured = !!apiKey;

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
      style={{ 
        backgroundColor: isConfigured ? 'var(--cb-primary-light)' : '#FFF3E0',
        color: isConfigured ? 'var(--cb-primary)' : 'var(--cb-warning)',
      }}
    >
      <div
        className={`w-2 h-2 rounded-full ${
          isConfigured ? 'bg-green-500' : 'bg-amber-500'
        }`}
      />
      <span className="font-medium">
        {isConfigured ? 'API接続中' : 'デモモード'}
      </span>
    </div>
  );
}

function UserMenu() {
  return (
    <button 
      className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
      style={{ 
        backgroundColor: '#E0E0E0',
        color: 'var(--cb-text-secondary)',
      }}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </button>
  );
}

export default Header;
