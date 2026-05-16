/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { Sparkles, ShieldCheck, LogIn } from 'lucide-react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { ProductCard } from './components/ProductCard';
import { ProductDetail } from './components/ProductDetail';
import { BottomNav } from './components/BottomNav';
import { CompareView } from './components/CompareView';
import { AddProductView } from './components/AddProductView';
import { LoginView } from './components/LoginView';
import { RegisterView } from './components/RegisterView';
import { SupplierDashboard } from './components/SupplierDashboard';
import { AdminSupplierManagement } from './components/AdminSupplierManagement';
import { AdvancedSearchPanel } from './components/AdvancedSearchPanel';
import { useAuth } from './context/AuthContext';
import { 
  subscribeToProducts, 
  subscribeToSuppliers, 
  seedInitialData,
  addProduct,
  updateProduct,
  deleteProduct,
  toggleSupplierVerification
} from './services/firestoreService';
import { performSemanticSearch, SemanticSearchResult } from './services/geminiService';
import { calculateRelevanceScore, hybridSort } from './utils/searchUtils';
import { Product, Supplier, ViewType, Filters, AdvancedFilters } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { translations } from './translations';

export default function App() {
  const { user, logout, loading: authLoading } = useAuth();
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [view, setView] = useState<ViewType>('home');
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [compareList, setCompareList] = useState<Product[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  
  // Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [useAiSearch, setUseAiSearch] = useState(false);
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([]);
  const [isAiSearching, setIsAiSearching] = useState(false);
  
  // Filter States
  const [activeFilters, setActiveFilters] = useState<Filters>({ category: 'all', sort: 'power' });
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    minPower: '', maxPower: '', minPrice: '', maxPrice: '', minEfficiency: '', brand: 'all'
  });
  
  // Supplier/Admin Management States
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilterId, setAdminFilterId] = useState<string | number | null>(null);
  const [supplierFilterId, setSupplierFilterId] = useState<string | number | null>(null);

  const isAr = lang === 'ar';
  const t = translations[lang];

  useEffect(() => {
    // Attempt seeding and setup real-time listeners
    if (user) {
      seedInitialData();
    }
    const unsubProducts = subscribeToProducts(setProducts);
    const unsubSuppliers = subscribeToSuppliers(setSuppliers);
    return () => {
      unsubProducts();
      unsubSuppliers();
    };
  }, [user]);

  // Handle Semantic Search Debounce
  useEffect(() => {
    if (!useAiSearch || searchTerm.length < 3) {
      setSemanticResults([]);
      setIsAiSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsAiSearching(true);
      try {
        const results = await performSemanticSearch(searchTerm, products, isAr);
        setSemanticResults(results);
      } catch (err) {
        console.error("AI Search Error:", err);
      } finally {
        setIsAiSearching(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [searchTerm, useAiSearch, products, isAr]);

  // Consolidated Filtering and Sorting Logic
  const filteredProducts = useMemo(() => {
    let items = [...products];

    // Filter by supplier if requested
    if (supplierFilterId) {
      items = items.filter(p => p.supplierId?.toString() === supplierFilterId.toString());
    }

    // Filter by Category
    if (activeFilters.category !== 'all') {
      items = items.filter(p => p.category === activeFilters.category);
    }

    // Advanced Filters (Power, Price, Efficiency, Brand)
    items = items.filter(p => {
      const matchesPower = (!advancedFilters.minPower || p.power >= parseInt(advancedFilters.minPower)) &&
                           (!advancedFilters.maxPower || p.power <= parseInt(advancedFilters.maxPower));
      const matchesPrice = (!advancedFilters.minPrice || p.price >= parseInt(advancedFilters.minPrice)) &&
                           (!advancedFilters.maxPrice || p.price <= parseInt(advancedFilters.maxPrice));
      const matchesEfficiency = (!advancedFilters.minEfficiency || p.efficiency >= parseFloat(advancedFilters.minEfficiency));
      const matchesBrand = advancedFilters.brand === 'all' || p.brand === advancedFilters.brand;
      
    // Keyword matching (Base layer)
      const keywordScore = calculateRelevanceScore(p, searchTerm, isAr);
      const isAILifted = semanticResults.some(r => r.productId === p.id?.toString());
      const matchesSearch = !searchTerm.trim() || searchTerm.length < 2 || keywordScore > 0 || isAILifted;

      return matchesPower && matchesPrice && matchesEfficiency && matchesBrand && matchesSearch;
    });

    // Sorting Logic
    items.sort((a, b) => {
      // 1. Semantic Priority
      if (useAiSearch && semanticResults.length > 0) {
        return hybridSort(a, b, semanticResults, searchTerm, isAr);
      }

      // 2. Keyword Relevance Priority
      if (searchTerm.trim().length >= 1 && !useAiSearch) {
        const scoreA = calculateRelevanceScore(a, searchTerm, isAr);
        const scoreB = calculateRelevanceScore(b, searchTerm, isAr);
        if (scoreA > 0 || scoreB > 0) {
          if (scoreA !== scoreB) return scoreB - scoreA;
        }
      }

      // 3. User Selected Sort
      if (activeFilters.sort === 'power') return b.power - a.power;
      if (activeFilters.sort === 'price') return a.price - b.price;
      if (activeFilters.sort === 'efficiency') return b.efficiency - a.efficiency;
      
      return 0;
    });

    return items;
  }, [products, searchTerm, activeFilters, advancedFilters, isAr, useAiSearch, semanticResults, supplierFilterId]);

  const toggleCompare = (product: Product) => {
    setCompareList(prev => {
      if (prev.find(p => p.id === product.id)) return prev.filter(p => p.id !== product.id);
      if (prev.length >= 4) {
        alert(isAr ? 'يمكنك مقارنة 4 منتجات فقط' : 'You can compare up to 4 products');
        return prev;
      }
      return [...prev, product];
    });
  };

  const toggleWishlist = (product: Product) => {
    if (!user) {
      setView('login');
      return;
    }
    setWishlist(prev => {
      if (prev.find(p => p.id === product.id)) return prev.filter(p => p.id !== product.id);
      return [...prev, product];
    });
  };

  const handleProductAction = async (productData: Omit<Product, 'id'>) => {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id.toString(), productData);
        setEditingProduct(null);
      } else {
        await addProduct(productData);
      }
      setView('supplier-dashboard');
    } catch (err) {
      console.error("Action error:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-solar-bg">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-solar-blue border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const renderContent = () => {
    switch (view) {
      case 'home':
        if (selectedProduct) {
          return (
            <ProductDetail 
              product={selectedProduct} 
              allProducts={products}
              lang={lang} 
              onBack={() => setSelectedProduct(null)} 
              onCompare={toggleCompare}
              onWishlist={toggleWishlist}
              isCompared={(id) => !!compareList.find(p => p.id === id)}
              isInWishlist={(id) => !!wishlist.find(p => p.id === id)}
              onProductClick={(p) => setSelectedProduct(p)}
              onFilterSupplier={(id) => {
                setSupplierFilterId(id);
                setSelectedProduct(null);
                setSearchTerm('');
              }}
              onEdit={(p) => {
                setEditingProduct(p);
                setSelectedProduct(null);
                setView('add');
              }}
            />
          );
        }
        return (
          <div className="space-y-6 pb-20">
            <FilterBar 
              lang={lang} 
              activeFilter={activeFilters} 
              setFilter={setActiveFilters} 
              searchTerm={searchTerm} 
              setSearchTerm={setSearchTerm} 
              useAiSearch={useAiSearch}
              setUseAiSearch={setUseAiSearch}
              supplierFilterId={supplierFilterId}
              onClearSupplierFilter={() => setSupplierFilterId(null)}
            />
            {isAiSearching && (
              <div className="flex items-center gap-2 mb-4 text-solar-blue font-black text-xs animate-pulse">
                <Sparkles size={14} />
                <span>{isAr ? 'جاري تحليل بحثك ذكياً...' : 'Analyzing search with AI...'}</span>
              </div>
            )}
            <AdvancedSearchPanel 
              lang={lang} 
              filters={advancedFilters} 
              setFilters={setAdvancedFilters} 
              onClear={() => setAdvancedFilters({ minPower: '', maxPower: '', minPrice: '', maxPrice: '', minEfficiency: '', brand: 'all' })}
            />
            
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredProducts.map(p => {
                  const aiResult = semanticResults.find(r => r.productId === p.id?.toString());
                  return (
                    <div key={p.id} className="relative group">
                      <ProductCard 
                        product={p} 
                        lang={lang} 
                        onClick={() => setSelectedProduct(p)} 
                        onCompare={(e) => { e.stopPropagation(); toggleCompare(p); }}
                        onWishlist={(e) => { e.stopPropagation(); toggleWishlist(p); }}
                        onEdit={(e, product) => {
                          e.stopPropagation();
                          setEditingProduct(product);
                          setView('add');
                        }}
                        isCompared={!!compareList.find(cp => cp.id === p.id)}
                        isWishlisted={!!wishlist.find(wp => wp.id === p.id)}
                      />
                      {useAiSearch && aiResult && (
                        <div className="absolute top-2 right-2 bg-solar-blue text-white p-2 rounded-xl shadow-xl z-20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none max-w-[200px]">
                          <div className="flex items-center gap-1 mb-1">
                            <Sparkles size={10} />
                            <span className="text-[10px] font-black uppercase">{t.aiMatching}</span>
                            <span className="ml-auto text-[10px] font-black">{Math.round(aiResult.relevanceScore * 100)}%</span>
                          </div>
                          <p className="text-[9px] leading-tight font-medium">{aiResult.matchReason}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-[40px] p-8 border border-solar-border shadow-sm">
                <div className="text-6xl mb-6 grayscale opacity-20">🔎</div>
                <h3 className="text-2xl font-black text-solar-text">{t.noData}</h3>
                <p className="text-solar-muted font-bold mt-2 max-w-xs mx-auto">
                  {isAr ? 'لم نجد نتائج مطابقة لبحثك. جرب كلمات بحث أخرى أو قم بتصفية الفلاتر.' : 'No matching results found. Try different keywords or clear filters.'}
                </p>
                {(activeFilters.category !== 'all' || advancedFilters.brand !== 'all' || advancedFilters.minPower || advancedFilters.maxPower || advancedFilters.minPrice || advancedFilters.maxPrice || advancedFilters.minEfficiency || supplierFilterId) && (
                  <button 
                    onClick={() => {
                      setActiveFilters({ category: 'all', sort: 'power' });
                      setAdvancedFilters({ minPower: '', maxPower: '', minPrice: '', maxPrice: '', minEfficiency: '', brand: 'all' });
                      setSupplierFilterId(null);
                      setSearchTerm('');
                    }}
                    className="mt-8 bg-solar-blue text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-solar-blue/20 transition-all hover:scale-105 active:scale-95"
                  >
                    {isAr ? 'إعادة تعيين كافة الفلاتر' : 'Reset All Filters'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      case 'wishlist':
        return (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-4xl font-black text-solar-text mb-2 flex items-center gap-3">
                  <span className="text-red-500">❤️</span>
                  {t.wishlist}
                </h1>
                <p className="text-solar-muted font-bold">{isAr ? `${wishlist.length} منتجات محفوظة` : `${wishlist.length} Saved Products`}</p>
              </div>
              <button 
                onClick={() => setView('home')}
                className="bg-solar-light text-solar-blue px-6 py-3 rounded-2xl font-black transition-all hover:bg-solar-blue hover:text-white"
              >
                {t.back}
              </button>
            </div>

            {wishlist.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {wishlist.map(p => (
                  <ProductCard 
                    key={p.id}
                    product={p} 
                    lang={lang} 
                    onClick={() => setSelectedProduct(p)} 
                    onCompare={(e) => { e.stopPropagation(); toggleCompare(p); }}
                    onWishlist={(e) => { e.stopPropagation(); toggleWishlist(p); }}
                    onEdit={(e, product) => {
                      e.stopPropagation();
                      setEditingProduct(product);
                      setView('add');
                    }}
                    isCompared={!!compareList.find(cp => cp.id === p.id)}
                    isWishlisted={true}
                  />
                ))}
              </div>
            ) : (
              <div className="py-20 text-center bg-white rounded-[40px] border border-solar-border shadow-sm">
                <div className="text-6xl mb-4 grayscale opacity-20">❤️</div>
                <h3 className="text-xl font-black text-solar-text">{t.emptyWishlist}</h3>
                <p className="text-solar-muted font-bold mt-2">{t.noWishlistItems}</p>
                <button 
                  onClick={() => setView('home')}
                  className="mt-8 bg-solar-blue text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-solar-blue/20 transition-all hover:scale-105 active:scale-95"
                >
                  {isAr ? 'استكشف المنتجات' : 'Explore Products'}
                </button>
              </div>
            )}
          </div>
        );
      case 'compare':
        return <CompareView products={compareList} lang={lang} onBack={() => setView('home')} onRemove={(id) => setCompareList(l => l.filter(p => p.id !== id))} />;
      case 'add':
        return <AddProductView lang={lang} onBack={() => { setView(user?.type === 'supplier' ? 'supplier-dashboard' : 'home'); setEditingProduct(null); }} onAdd={handleProductAction} editingProduct={editingProduct} />;
      case 'login':
        return <LoginView lang={lang} setView={setView} />;
      case 'register':
        return <RegisterView lang={lang} setView={setView} />;
      case 'supplier-dashboard':
        return (
          <SupplierDashboard 
            lang={lang} 
            setView={setView} 
            products={products} 
            suppliers={suppliers}
            onDelete={async (id) => { if(confirm(isAr ? 'تأكيد الحذف؟' : 'Confirm Delete?')) await deleteProduct(id.toString()); }}
            onEdit={(p) => { setEditingProduct(p); setView('add'); }}
            adminSearch={adminSearch}
            setAdminSearch={setAdminSearch}
            adminFilterId={adminFilterId}
          />
        );
      case 'admin-suppliers':
        return (
          <AdminSupplierManagement 
            lang={lang} 
            suppliers={suppliers} 
            onToggleVerification={(id) => {
              const s = suppliers.find(sup => sup.id === id);
              if (s) toggleSupplierVerification(id.toString(), !s.verified);
            }}
            onBack={() => setView('supplier-dashboard')}
            initialSearch={adminSearch}
            onViewSupplier={(id) => { setAdminFilterId(id); setView('supplier-dashboard'); }}
          />
        );
      case 'profile':
        return (
          <div className="max-w-md mx-auto py-10">
            <div className="bg-white rounded-[40px] p-8 border border-solar-border shadow-xl text-center">
              <div className="relative inline-block mb-6">
                <img src={user?.avatar} className="w-24 h-24 rounded-full border-4 border-solar-blue object-cover shadow-lg" alt="" />
                {user?.verified && (
                  <div className="absolute -bottom-1 -right-1 bg-solar-blue text-white p-1.5 rounded-full shadow-lg">
                    <ShieldCheck size={16} />
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-black text-solar-text">{isAr ? user?.nameAr || user?.name : user?.name}</h2>
              <p className="text-solar-muted font-bold mt-1">{user?.email}</p>
              <div className="mt-4 inline-flex items-center gap-2 bg-solar-light text-solar-blue px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter">
                {isAr ? 'حساب شخصي' : 'Personal Account'}
              </div>
              
              <div className="mt-10 pt-10 border-t border-solar-border space-y-3">
                <button 
                  onClick={() => logout()}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 p-4 rounded-2xl font-black transition-all hover:bg-red-100"
                >
                  <LogIn className="rotate-180" size={20} />
                  {t.logout}
                </button>
                <button 
                  onClick={() => setView('home')}
                  className="w-full text-solar-muted font-bold p-2 hover:text-solar-blue transition-colors"
                >
                  {t.back}
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen bg-solar-bg ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      <Header lang={lang} setLang={setLang} user={user} onLogout={logout} setView={setView} />
      
      <main className="max-w-7xl mx-auto px-4 pt-6 pb-32 md:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={view + (selectedProduct?.id || '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {compareList.length > 0 && view !== 'compare' && (
        <motion.div 
          initial={{ y: 100 }} animate={{ y: 0 }}
          className="fixed bottom-24 md:bottom-10 right-4 left-4 md:left-auto md:w-80 bg-solar-blue text-white p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between"
        >
          <div className="flex -space-x-2 overflow-hidden">
            {compareList.slice(0, 3).map(p => (
              <img key={p.id} src={p.image} className="w-8 h-8 rounded-full border-2 border-solar-blue object-cover shrink-0" alt="" />
            ))}
          </div>
          <div className="px-4 text-xs font-black uppercase">{compareList.length} {isAr ? 'منتجات' : 'Products'}</div>
          <button onClick={() => setView('compare')} className="bg-white text-solar-blue px-4 py-2 rounded-xl text-xs font-black shadow-lg">
            {isAr ? 'قارن الآن' : 'Compare Now'}
          </button>
        </motion.div>
      )}

      <BottomNav currentView={view} setView={setView} lang={lang} user={user} />
    </div>
  );
}
