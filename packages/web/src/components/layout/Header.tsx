import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Moon, Sun, Globe, Search, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { NotificationPanel } from './NotificationPanel';

// ---------------------------------------------------------------------------
// Language options (Central Asian focus)
// ---------------------------------------------------------------------------

interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
}

const languages: LanguageOption[] = [
  { code: 'uz', label: 'Uzbek', nativeLabel: "O'zbek" },
  { code: 'ky', label: 'Kyrgyz', nativeLabel: 'Кыргызча' },
  { code: 'tg', label: 'Tajik', nativeLabel: 'Тоҷикӣ' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Русский' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
];

// ---------------------------------------------------------------------------
// Icon Button helper
// ---------------------------------------------------------------------------

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  badge?: number;
  onClick?: () => void;
  className?: string;
}

function IconButton({ icon: Icon, label, badge, onClick, className }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative rounded-lg p-2 text-slate-500 transition-colors',
        'hover:bg-slate-100 hover:text-slate-700',
        'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        className,
      )}
      aria-label={label}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-2xs font-bold text-white"
          aria-label={`${badge} notifications`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Theme Toggle
// ---------------------------------------------------------------------------

function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('uzavita-theme', next ? 'dark' : 'light');
  };

  // Initialize from stored preference
  useEffect(() => {
    const stored = localStorage.getItem('uzavita-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = stored === 'dark' || (!stored && prefersDark);
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  return { isDark, toggle };
}

// ---------------------------------------------------------------------------
// Header Component
// ---------------------------------------------------------------------------

export function Header() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const { isDark, toggle: toggleTheme } = useTheme();

  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');

  const langMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && searchQuery.trim()) {
        // Navigate based on search term - basic keyword matching
        const q = searchQuery.toLowerCase();
        if (q.includes('appointment')) {
          navigate('/patient/appointments');
        } else if (q.includes('record') || q.includes('medical')) {
          navigate('/patient/records');
        } else if (q.includes('device') || q.includes('wearable')) {
          navigate('/patient/devices');
        } else if (q.includes('telemetry') || q.includes('vital')) {
          navigate('/patient/telemetry');
        } else if (q.includes('triage')) {
          navigate('/patient/triage');
        } else if (q.includes('profile') || q.includes('setting')) {
          navigate('/patient/profile');
        }
        setSearchQuery('');
      }
    },
    [searchQuery, navigate],
  );

  const handleNotificationToggle = useCallback(() => {
    setShowNotifications((prev) => !prev);
    setShowUserMenu(false);
    setShowLangMenu(false);
  }, []);

  const handleProfileSettings = useCallback(() => {
    setShowUserMenu(false);
    navigate('/patient/profile');
  }, [navigate]);

  const handlePrivacySecurity = useCallback(() => {
    setShowUserMenu(false);
    navigate('/patient/profile');
  }, [navigate]);

  const handleLogout = useCallback(() => {
    setShowUserMenu(false);
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const currentLang = languages.find((l) => l.code === user?.preferredLanguage) ?? languages[4];

  return (
    <header
      className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6 dark:border-slate-700 dark:bg-slate-900"
      role="banner"
    >
      {/* Search */}
      <div className="flex flex-1 items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search patients, records, or features..."
            value={searchQuery}
            onChange={handleSearch}
            onKeyDown={handleSearchKeyDown}
            className={cn(
              'w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm',
              'text-slate-900 placeholder:text-slate-400',
              'transition-colors focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500',
              'dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500',
              'dark:focus:bg-slate-800',
            )}
            aria-label="Global search"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Language selector */}
        <div ref={langMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowLangMenu((prev) => !prev)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-slate-500 transition-colors',
              'hover:bg-slate-100 hover:text-slate-700',
              'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
            )}
            aria-label="Select language"
            aria-expanded={showLangMenu}
            aria-haspopup="listbox"
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span className="hidden text-xs font-medium sm:inline">
              {currentLang.code.toUpperCase()}
            </span>
          </button>

          {showLangMenu && (
            <div
              className={cn(
                'absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg',
                'dark:border-slate-700 dark:bg-slate-800',
              )}
              role="listbox"
              aria-label="Language options"
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={lang.code === currentLang.code}
                  onClick={() => {
                    updateUser({ preferredLanguage: lang.code });
                    setShowLangMenu(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-sm transition-colors',
                    lang.code === currentLang.code
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700',
                  )}
                >
                  <span>{lang.label}</span>
                  <span className="text-xs text-slate-400">{lang.nativeLabel}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <IconButton
          icon={isDark ? Sun : Moon}
          label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
        />

        {/* Notifications */}
        <div ref={notificationRef} className="relative">
          <IconButton
            icon={Bell}
            label="View notifications"
            badge={notificationCount}
            onClick={handleNotificationToggle}
          />
          <NotificationPanel
            open={showNotifications}
            onClose={() => setShowNotifications(false)}
          />
        </div>

        {/* User avatar / menu */}
        <div ref={userMenuRef} className="relative ml-2">
          <button
            type="button"
            onClick={() => setShowUserMenu((prev) => !prev)}
            className={cn(
              'flex items-center gap-2 rounded-lg p-1 transition-colors',
              'hover:bg-slate-100 dark:hover:bg-slate-800',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
            )}
            aria-label="User menu"
            aria-expanded={showUserMenu}
            aria-haspopup="menu"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-300">
              {user?.firstName?.[0] ?? 'U'}
              {user?.lastName?.[0] ?? ''}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-2xs capitalize text-slate-500 dark:text-slate-400">
                {user?.role?.replace('_', ' ') ?? 'User'}
              </p>
            </div>
          </button>

          {showUserMenu && (
            <div
              className={cn(
                'absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg',
                'dark:border-slate-700 dark:bg-slate-800',
              )}
              role="menu"
            >
              <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {user?.email}
                </p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleProfileSettings}
                className="flex w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Profile Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handlePrivacySecurity}
                className="flex w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Privacy & Security
              </button>
              <button
                type="button"
                role="menuitem"
                className="flex w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Help & Support
              </button>
              <div className="border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
