import React, { useState } from 'react';
import { Home, BookOpen, ClipboardList, TrendingUp, Settings, XCircle, Menu as MenuIcon } from '../icons';

const menuItems = [
  { label: 'Ana Sayfa', icon: <Home />, path: '/' },
  { label: 'Kitap Analizi', icon: <BookOpen />, path: '/kitap-analiz' },
  { label: 'Görevler', icon: <ClipboardList />, path: '/gorevler' },
  { label: 'Performans', icon: <TrendingUp />, path: '/performans' },
  { label: 'Ayarlar', icon: <Settings />, path: '/ayarlar' },
];

const DrawerMenu: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);

  const handleMenuClick = () => setOpen(!open);
  const handleItemClick = (path: string) => {
    setOpen(false);
    if (onNavigate) onNavigate(path);
  };

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 bg-primary-600 text-white p-2 rounded-full shadow-lg focus:outline-none"
        onClick={handleMenuClick}
        aria-label={open ? 'Menüyü Kapat' : 'Menüyü Aç'}
      >
        {open ? <XCircle className="w-7 h-7" /> : <MenuIcon className="w-7 h-7" />}
      </button>
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-40 transform transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        role="navigation"
        aria-label="Drawer Menü"
      >
        <div className="p-6 border-b flex items-center justify-between">
          <span className="text-xl font-bold text-primary-700">Menü</span>
          <button onClick={handleMenuClick} aria-label="Menüyü Kapat">
            <XCircle className="w-6 h-6 text-slate-500" />
          </button>
        </div>
        <ul className="p-4 space-y-2">
          {menuItems.map(item => (
            <li key={item.path}>
              <button
                className="flex items-center w-full px-3 py-2 rounded-lg hover:bg-primary-100 text-slate-700"
                onClick={() => handleItemClick(item.path)}
              >
                <span className="mr-3">{item.icon}</span>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {open && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30"
          onClick={handleMenuClick}
          aria-label="Menüyü Kapatmak için tıkla"
        />
      )}
    </>
  );
};

export default DrawerMenu;
