/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, ShieldCheck, LogIn, ChevronLeft, ChevronRight, Sun, Zap, Battery, Wrench, Calculator } from 'lucide-react';
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
import { SolarCalculator } from './components/SolarCalculator';
import { ProfileView } from './components/ProfileView';
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
import { auth } from './lib/firebase';
import { safeLocalStorage } from './utils/safeStorage';

export default function App() {
  const { user, logout, loading: authLoading } = useAuth();
  
  // Default consistently to Arabic with safe storage fallback
  const [lang, setLang] = useState<'ar' | 'en'>(() => {
    const saved = safeLocalStorage.getItem('enerjoo_lang');
    return (saved === 'ar' || saved === 'en') ? saved : 'ar';
  });

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

  // Persist language selections in safeLocalStorage & configure document layout dynamically
  useEffect(() => {
    safeLocalStorage.setItem('enerjoo_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

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
            {/* AI Engineering Solar Sizing Promo Banner */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-solar-blue via-indigo-600 to-indigo-700 text-white rounded-[32px] p-6 md:p-8 shadow-xl shadow-indigo-600/10 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-solar-blue/10 rounded-full blur-2xl -ml-16 -mb-16"></div>
              
              <div className="space-y-2 relative z-10 text-right md:text-right w-full md:w-3/4">
                <div className="inline-flex items-center gap-1.5 bg-white/10 text-amber-300 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                  <Sparkles size={12} className="animate-pulse" />
                  <span>{isAr ? 'ميزة حصرية هندسية' : 'EXCLUSIVE AI ENGINEERING'}</span>
                </div>
                <h2 className="text-xl md:text-2xl font-display font-black tracking-tight leading-snug">
                  {isAr 
                    ? 'صمم محطتك الشمسية المتكاملة واحسب تكاليفها بالذكاء الاصطناعي ⚡' 
                    : 'Design Your Full Solar Station & Estimate Costs Instantly ⚡'}
                </h2>
                <p className="text-xs md:text-sm text-white/85 font-medium leading-relaxed max-w-2xl">
                  {isAr 
                    ? 'حدد نوع نظامك (متصل بالشبكة، نظام هجين، أو منفصل) واحسب استهلاكك أو حدد قائمة أجهزتك الخاصة، وسيقوم مهندسنا الذكي بمطابقة أفضل القطع والماركات المتاحة من الموردين وتوليد دراسة جدوى استرشادية مخصصة وعروض أسعار في ثوانٍ معدودة!' 
                    : 'Select your target system architecture, calculate load or select appliances, and we will automatically engineer the design, match best brands, and output real-time Egyptian pricing estimates!'}
                </p>
              </div>

              <button 
                onClick={() => setView('calculator')}
                className="w-full md:w-auto shrink-0 bg-white hover:bg-amber-100 text-indigo-700 hover:text-indigo-800 font-black text-xs md:text-sm px-7 py-4 rounded-xl transition duration-300 transform hover:scale-105 active:scale-95 shadow-md shadow-black/10 cursor-pointer relative z-10 flex items-center justify-center gap-2"
              >
                <Calculator size={18} />
                <span>{isAr ? 'ابدأ التصميم والاحتساب الذكي' : 'Start Sizing & Design'}</span>
              </button>
            </motion.div>

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
              supplierFilterId ? (
                // Supplier Profile view grouped by sections
                (() => {
                  const activeSup = suppliers.find(s => s.id?.toString() === supplierFilterId.toString());
                  const supPanels = filteredProducts.filter(p => p.category === 'panels');
                  const supInverters = filteredProducts.filter(p => p.category === 'inverters');
                  const supBatteries = filteredProducts.filter(p => p.category === 'batteries');
                  const supOthers = filteredProducts.filter(p => p.category !== 'panels' && p.category !== 'inverters' && p.category !== 'batteries');

                  const supGroups = [
                    { title: isAr ? 'قسم ألواح الطاقة الشمسية' : 'Solar Panels Section', items: supPanels, icon: '☀️' },
                    { title: isAr ? 'قسم محولات التيار والعواكس' : 'Inverters Section', items: supInverters, icon: '⚡' },
                    { title: isAr ? 'قسم البطاريات ووحدات التخزين' : 'Batteries Section', items: supBatteries, icon: '🔋' },
                    { title: isAr ? 'قسم الملحقات والمكونات الأخرى' : 'System Components & Accessories', items: supOthers, icon: '⚙️' },
                  ].filter(g => g.items.length > 0);

                  return (
                    <div className="space-y-12">
                      {/* Supplier Profile Badge Card */}
                      {activeSup && (
                        <div className="bg-white rounded-[40px] p-6 md:p-8 border border-solar-border shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-solar-blue text-white rounded-3xl flex items-center justify-center text-2xl font-black shadow-md shadow-solar-blue/20">
                              {isAr ? (activeSup.nameAr || activeSup.name)?.[0] : activeSup.name?.[0]}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h2 className="text-2xl font-black text-solar-text">{isAr ? activeSup.nameAr || activeSup.name : activeSup.name}</h2>
                                {activeSup.verified && (
                                  <span className="bg-solar-success/15 text-solar-success text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                                    <ShieldCheck size={12} />
                                    {isAr ? 'مورد معتمد' : 'VERIFIED'}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-solar-muted font-bold mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span>📍 {activeSup.location}</span>
                                <span className="text-solar-border/70">|</span>
                                <span className="cursor-pointer text-solar-blue hover:underline" onClick={() => {
                                  if (activeSup.phone) {
                                    const phone = activeSup.phone.replace(/\+/g, '').replace(/\s+/g, '');
                                    window.open(`https://wa.me/${phone}`, '_blank');
                                  }
                                }}>📞 {activeSup.phone}</span>
                              </p>
                            </div>
                          </div>

                          <button 
                            onClick={() => setSupplierFilterId(null)}
                            className="w-full md:w-auto bg-solar-light text-solar-muted hover:text-solar-blue border border-solar-border/40 px-6 py-3 rounded-2xl font-black text-sm transition"
                          >
                            {isAr ? 'عرض كل الموردين' : 'View All Suppliers'}
                          </button>
                        </div>
                      )}

                      {/* Group sections */}
                      <div className="space-y-12">
                        {supGroups.map((group, index) => (
                          <div key={index} className="space-y-6">
                            <div className="flex items-center gap-2 border-b border-solar-border/60 pb-3">
                              <span className="text-2xl">{group.icon}</span>
                              <h3 className="text-xl font-black text-solar-text">{group.title}</h3>
                              <span className="bg-solar-light text-solar-muted text-xs font-black px-2.5 py-1 rounded-full">{group.items.length} {t.products}</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                              {group.items.map(p => (
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
                                  isWishlisted={!!wishlist.find(wp => wp.id === p.id)}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
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
              )
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
            onBack={() => setView('home')}
            initialSearch={adminSearch}
            onViewSupplier={(id) => { setSupplierFilterId(id); setView('home'); }}
          />
        );
      case 'profile':
        return (
          <ProfileView 
            lang={lang}
            setLang={setLang}
            user={user}
            logout={logout}
            setView={setView}
            wishlistCount={wishlist.length}
            compareCount={compareList.length}
            productsCount={user ? products.filter(p => p.supplierId === user.uid).length : 0}
          />
        );
      case 'calculator':
        return (
          <SolarCalculator 
            lang={lang}
            products={products}
            onBack={() => setView('home')}
            onProductClick={(p) => {
              setSelectedProduct(p);
              setView('home');
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen bg-solar-bg ${isAr ? 'rtl' : 'ltr'}`} dir={isAr ? 'rtl' : 'ltr'}>
      {view !== 'login' && view !== 'register' && (
        <Header lang={lang} setLang={setLang} user={user} onLogout={logout} setView={setView} />
      )}
      
      {user && (
        <div className="max-w-7xl mx-auto px-4 mt-2">
          {/* Case 2: Supplier, but admin has not approved them yet */}
          {user.type === 'supplier' && !user.verified && (
            <div className="bg-blue-600 text-white text-xs py-3.5 px-4 font-bold flex items-center justify-center gap-2 rounded-2xl border border-blue-700/30 shadow-md">
              <span className="text-sm">🕒</span>
              <span>
                {isAr
                  ? 'حساب المورد الخاص بك قيد الانتظار لمراجعة الإدارة والموافقة (Pending Approval). لن تتمكن من إضافة ونشر منتجاتك حتى يتم التوثيق.'
                  : 'Your supplier account is pending admin approval. You will be able to add and publish products once your profile is verified.'}
              </span>
            </div>
          )}
        </div>
      )}
      
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
