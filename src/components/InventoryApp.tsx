import { useState, useMemo, useEffect } from 'react';
import { InventoryItem, SortField, SortOrder } from '../types';
import { StatCard } from './StatCard';
import { ItemModal } from './ItemModal';
import { 
  Package, Search, Plus, Edit2, Trash2, ArrowUpDown, RefreshCcw, LogOut
} from 'lucide-react';
import { initAuth, googleSignIn, logout, getAccessToken } from '../lib/auth';
import { loadInventoryFromSheets, saveInventoryToSheets } from '../lib/sheets';
import { User } from 'firebase/auth';

export function InventoryApp() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastUpdated');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);

  const [needsAuth, setNeedsAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setUser(user);
        setNeedsAuth(false);
        fetchData();
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
        setItems([]);
      }
    );
    return () => unsubscribe();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await loadInventoryFromSheets();
      setItems(data);
    } catch (error) {
      console.error('Failed to load data', error);
      // If we fail due to auth or expired token (401), force re-login
      if (error instanceof Error && (error.message.includes('Not authenticated') || error.message.includes('Failed to load data'))) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        fetchData();
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setItems([]);
  };

  // Stats calculation
  const totalItems = items.length;

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let result = items;
    
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = items.filter(item => 
        item.name.toLowerCase().includes(lowerQuery) ||
        item.sku.toLowerCase().includes(lowerQuery) ||
        item.category.toLowerCase().includes(lowerQuery)
      );
    }

    return result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, searchQuery, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const saveItems = async (newItems: InventoryItem[]) => {
    setItems(newItems);
    try {
      await saveInventoryToSheets(newItems);
    } catch (error) {
      console.error('Failed to save to sheets', error);
      alert('Gagal menyimpan ke Google Sheets. Pastikan Anda masih terhubung.');
    }
  };

  const handleSaveItem = (itemData: Omit<InventoryItem, 'id' | 'lastUpdated'>) => {
    let newItems;
    if (editingItem) {
      newItems = items.map(item => 
        item.id === editingItem.id 
          ? { ...item, ...itemData, lastUpdated: new Date().toISOString() }
          : item
      );
    } else {
      const newItem: InventoryItem = {
        ...itemData,
        id: crypto.randomUUID(),
        lastUpdated: new Date().toISOString(),
      };
      newItems = [newItem, ...items];
    }
    saveItems(newItems);
  };

  const handleDelete = (item: InventoryItem) => {
    setItemToDelete(item);
  };

  if (needsAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Package size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Sistem Inventaris</h1>
          <p className="text-gray-500 mb-8 text-sm">Masuk untuk mengelola data barang yang tersinkronisasi langsung dengan Google Sheets Anda.</p>
          
          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed text-sm font-medium text-gray-700"
          >
            {isLoggingIn ? (
              <RefreshCcw size={20} className="animate-spin text-gray-400" />
            ) : (
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </svg>
            )}
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sistem Inventaris Barang</h1>
            <p className="text-gray-500 mt-1">Kelola stok dan pantau pergerakan barang secara real-time.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isLoading && (
              <span className="text-sm text-gray-500 flex items-center gap-2 mr-2">
                <RefreshCcw size={16} className="animate-spin" /> Sinkronisasi...
              </span>
            )}
            <button 
              onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <Plus size={20} />
              Tambah Barang
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-gray-700 border border-gray-200 font-medium rounded-xl hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
              title="Keluar akun"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-1 gap-4">
          <StatCard title="Total SKU Barang" value={totalItems} icon={<Package size={24} />} />
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="p-4 md:p-6 border-b border-gray-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Data Barang</h2>
            <div className="flex w-full max-w-md gap-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Cari SKU, nama, atau kategori di database..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                />
              </div>
              <button 
                onClick={fetchData} 
                disabled={isLoading}
                className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 flex items-center justify-center transition-colors disabled:opacity-50"
                title="Sinkronisasi dari Google Sheets"
              >
                <RefreshCcw size={18} className={isLoading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 whitespace-nowrap">
              <thead className="bg-gray-50/50 text-gray-700 font-medium border-b border-gray-100">
                <tr>
                  {[
                    { key: 'sku', label: 'SKU' },
                    { key: 'name', label: 'Nama Barang' },
                    { key: 'category', label: 'Kategori' },
                    { key: 'location', label: 'Lokasi' },
                  ].map((col) => (
                    <th 
                      key={col.key}
                      onClick={() => handleSort(col.key as SortField)}
                      className="px-6 py-4 cursor-pointer hover:bg-gray-100/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        {col.label}
                        <ArrowUpDown size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredAndSortedItems.length > 0 ? (
                  filteredAndSortedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.sku}</td>
                      <td className="px-6 py-4">{item.name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">{item.location || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(item)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <Package size={48} className="text-gray-300 mb-4" />
                        <p className="text-base font-medium text-gray-900">Tidak ada barang ditemukan</p>
                        <p className="text-sm mt-1">Coba sesuaikan kata kunci pencarian atau tambah barang baru.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <ItemModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        onSave={handleSaveItem}
        item={editingItem}
      />

      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl p-6 text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Hapus Barang?</h2>
            <p className="text-gray-500 mb-6 text-sm">
              Apakah Anda yakin ingin menghapus <span className="font-semibold text-gray-700">{itemToDelete.name}</span>? Tindakan ini akan menghapusnya dari Google Sheets secara permanen.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const newItems = items.filter(i => i.id !== itemToDelete.id);
                  saveItems(newItems);
                  setItemToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
              >
                Hapus Barang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
