import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  X, 
  Send, 
  RotateCcw, 
  Bot, 
  User, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Award,
  Layers,
  Check,
  Cpu,
  ShieldCheck,
  ShoppingBag
} from 'lucide-react';
import { InverterAgentRecommendationResponse, TierProductRecommendation } from '../types/inverter';

export interface ChatProductItem {
  product_id?: string;
  id?: string | number;
  brand?: string;
  model?: string;
  product_category?: string;
  product_type?: string;
  technology?: string;
  power_w?: number;
  rated_power_kw?: number;
  price_egp?: number;
  price?: number;
  availability?: string;
  image_url?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
  failedPrompt?: string;
  recommendation?: InverterAgentRecommendationResponse | null;
  products?: ChatProductItem[] | null;
}

interface EnerjooAIChatProps {
  lang?: 'ar' | 'en';
  isOpen?: boolean;
  onClose?: () => void;
  showFloatingTrigger?: boolean;
  activeProductId?: string;
}

const CF_CHAT_URL = 'https://enerjoo-api.enerjoo320.workers.dev/chat';
const STORAGE_SESSION_KEY = 'enerjoo_ai_chat_session_id';
const STORAGE_MESSAGES_KEY = 'enerjoo_ai_chat_history';

/**
 * Standard UUID v4 generator
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isValidUUID(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'init-1',
    sender: 'assistant',
    text: 'أهلاً بك في Enerjoo AI ⚡ مستشارك الفني والتجاري لاختيار وتصميم أنظمة وإنفرترات الطاقة الشمسية.\n\nهل تبحث عن نظام On-Grid متصل بالشبكة، أم Off-Grid ببطاريات، أم لمضخات الري الزراعي؟ أو يمكنك كتابة قدرة المحطة والمواصفات المطلوبة مباشرة وسأرشح لك أفضل المطابقات والبدائل من الكتالوج!',
    timestamp: new Date().toISOString()
  }
];

const QUICK_PROMPTS = [
  'إنفرتر 100 كيلو On-Grid 3 فاز',
  'أرخص إنفرتر 50 كيلو مطابق',
  'قارن بين إنفرترات الكتالوج',
  'إنفرتر طلمبة ري 30 حصان',
  'إنفرتر Off-Grid 5 كيلو مع بطاريات',
  'أعلى إنفرتر كفاءة في الكتالوج'
];

/**
 * Interactive Inverter Recommendation Card & Comparison Matrix
 */
function InverterRecommendationView({ rec }: { rec: InverterAgentRecommendationResponse }) {
  const [showTable, setShowTable] = useState(false);

  const handleOpenProduct = (productId: string | number) => {
    window.dispatchEvent(new CustomEvent('open-product-details', { detail: { productId } }));
  };

  if (!rec.exact_match_found) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-200/90 space-y-2.5 text-right" dir="rtl">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 flex items-start gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-amber-950">تنبيه مستشار Enerjoo الفني:</p>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              لم نجد تطابقاً كاملاً 100% في الكتالوج الحالي يفي بكافة الشروط في آن واحد؛ والتزاماً منا بعدم اختراع أو تخمين مواصفات غير متوفرة، إليك أقرب البدائل المتوفرة فعلياً:
            </p>
          </div>
        </div>

        {rec.closest_alternatives && rec.closest_alternatives.map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">{item.brand} {item.model}</span>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {item.rated_power_kw} kW • {item.phase}
              </span>
            </div>
            {item.discrepancy_ar && (
              <p className="text-[11px] text-amber-800 font-bold bg-amber-50/80 border border-amber-200/60 rounded-lg px-2 py-1">
                ⚠️ فارق المواصفة: {item.discrepancy_ar}
              </p>
            )}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="font-black text-blue-700">
                {item.price > 0 ? `${item.price.toLocaleString('ar-EG')} ج.م` : 'حسب العرض'}
              </span>
              <button
                type="button"
                onClick={() => handleOpenProduct(item.product_id)}
                className="text-[11px] font-black text-blue-600 hover:text-blue-800 underline flex items-center gap-1 cursor-pointer"
              >
                <span>عرض في الكتالوج</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-200/90 space-y-3 text-right" dir="rtl">
      {/* 1. Best Match Card */}
      {rec.best_match && (
        <div className="bg-gradient-to-br from-blue-50/95 via-sky-50/50 to-indigo-50/40 border-2 border-blue-400/90 rounded-2xl p-3 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black bg-blue-600 text-white px-2.5 py-1 rounded-full shadow-xs">
              <Award className="w-3.5 h-3.5" />
              أفضل اختيار (Best Match)
            </span>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
              <Check className="w-3 h-3 text-emerald-600" />
              {rec.best_match.availability ? 'متوفر فورياً بالمخزن' : 'معتمد'}
            </span>
          </div>

          <div className="flex gap-2.5 items-center pt-1">
            {rec.best_match.image && (
              <img 
                src={rec.best_match.image} 
                alt={rec.best_match.model} 
                className="w-16 h-16 rounded-xl object-contain bg-white border border-slate-200 p-1 shrink-0 shadow-2xs" 
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                {rec.best_match.brand} {rec.best_match.model}
              </h4>
              <p className="text-[11px] font-black text-blue-700 mt-0.5">
                {rec.best_match.rated_power_kw} kW • {rec.best_match.phase} • {rec.best_match.type}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-slate-600 mt-1">
                {rec.best_match.efficiency_percent !== 'Unknown' && (
                  <span className="font-bold text-slate-700">كفاءة: {rec.best_match.efficiency_percent}%</span>
                )}
                {rec.best_match.mppt_count !== 'Unknown' && (
                  <span>• {rec.best_match.mppt_count} متتبعات MPPT</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-blue-100 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block leading-tight">السعر في الكتالوج</span>
              <span className="text-xs sm:text-sm font-black text-slate-900">
                {rec.best_match.price > 0 ? `${rec.best_match.price.toLocaleString('ar-EG')} ج.م` : 'حسب العرض'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleOpenProduct(rec.best_match!.product_id)}
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black text-xs px-3.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>عرض المنتج بالكتالوج</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Alternative Card (if present) */}
      {rec.alternative && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full">
              🔄 البديل المقترح (Alternative)
            </span>
            <span className="text-xs font-black text-slate-900 truncate max-w-[160px]">
              {rec.alternative.brand} {rec.alternative.model}
            </span>
          </div>
          {rec.alternative.difference_ar && (
            <p className="text-[11px] text-slate-700 bg-white border border-slate-200/80 rounded-lg px-2 py-1 leading-relaxed">
              الفارق الفني: {rec.alternative.difference_ar}
            </p>
          )}
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="font-black text-slate-800">
              {rec.alternative.price > 0 ? `${rec.alternative.price.toLocaleString('ar-EG')} ج.م` : 'حسب العرض'}
            </span>
            <button
              type="button"
              onClick={() => handleOpenProduct(rec.alternative!.product_id)}
              className="text-[11px] font-black text-blue-600 hover:text-blue-800 underline flex items-center gap-1 cursor-pointer"
            >
              <span>عرض البديل</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Best Value Card (if present) */}
      {rec.best_value && rec.best_value.product_id !== rec.best_match?.product_id && (
        <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-2.5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">
              💎 أفضل قيمة مقابل السعر
            </span>
            <span className="font-black text-emerald-950 truncate max-w-[160px]">
              {rec.best_value.brand} ({rec.best_value.rated_power_kw} kW)
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="font-black text-emerald-800">
              {rec.best_value.price.toLocaleString('ar-EG')} ج.م
            </span>
            <button
              type="button"
              onClick={() => handleOpenProduct(rec.best_value!.product_id)}
              className="text-[11px] font-black text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1 cursor-pointer"
            >
              <span>فتح بالمتجر</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 4. Specification Comparison Table (Expandable) */}
      {rec.comparison_table && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className="w-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-black py-2 px-3 rounded-xl flex items-center justify-between transition-colors cursor-pointer border border-slate-200/60"
          >
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              جدول المقارنة الفنية الشاملة بين البدائل ({rec.comparison_table.rows.length} مواصفة)
            </span>
            {showTable ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
          </button>

          {showTable && (
            <div className="mt-2 overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs max-h-64 scrollbar-thin">
              <table className="w-full text-[11px] text-right divide-y divide-slate-200">
                <thead className="bg-slate-50 font-black text-slate-700 sticky top-0">
                  <tr>
                    {rec.comparison_table.headersAr.map((h, i) => (
                      <th key={i} className="px-2.5 py-2 whitespace-nowrap bg-slate-50">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rec.comparison_table.rows.map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-2.5 py-1.5 font-bold text-slate-600 whitespace-nowrap">
                        {row.labelAr}
                      </td>
                      <td className="px-2.5 py-1.5 font-black text-blue-900 whitespace-nowrap">
                        {row.bestMatch}
                      </td>
                      {row.alternative !== undefined && (
                        <td className="px-2.5 py-1.5 text-slate-700 whitespace-nowrap">
                          {row.alternative}
                        </td>
                      )}
                      {row.bestValue !== undefined && (
                        <td className="px-2.5 py-1.5 text-emerald-800 font-bold whitespace-nowrap">
                          {row.bestValue}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Cloudflare Worker Products Display
 * Shows proposed products from Enerjoo catalog with selection toggle
 */
function WorkerProductCardsView({ 
  products, 
  selectedProductIds, 
  onToggleSelect 
}: { 
  products: ChatProductItem[];
  selectedProductIds: string[];
  onToggleSelect: (productId: string) => void;
}) {
  const handleOpenProduct = (productId: string | number) => {
    window.dispatchEvent(new CustomEvent('open-product-details', { detail: { productId } }));
  };

  return (
    <div className="mt-3 pt-3 border-t border-slate-200/90 space-y-2.5 text-right" dir="rtl">
      <div className="flex items-center justify-between text-xs text-slate-700 font-black px-1">
        <span className="flex items-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
          منتجات مطابقة ومقترحة من الكتالوج:
        </span>
        <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
          {products.length} منتج
        </span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5 scrollbar-thin">
        {products.map((prod, idx) => {
          const pid = String(prod.product_id || prod.id || `prod-${idx}`);
          const isSelected = selectedProductIds.includes(pid);
          const priceValue = typeof prod.price_egp === 'number' ? prod.price_egp : (typeof prod.price === 'number' ? prod.price : null);
          return (
            <div 
              key={pid}
              className={`bg-white border rounded-xl p-2.5 transition-all shadow-2xs ${
                isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex gap-2.5 items-center">
                {prod.image_url ? (
                  <img
                    src={prod.image_url}
                    alt={prod.model || prod.brand}
                    className="w-14 h-14 rounded-lg object-contain bg-slate-50 border border-slate-100 p-1 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 font-bold text-xs">
                    ⚡
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h5 className="text-xs font-black text-slate-900 truncate">
                      {prod.brand} {prod.model}
                    </h5>
                    {prod.availability && (
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-1.5 py-0.5 rounded font-bold shrink-0">
                        {prod.availability === 'Available' ? 'متوفر' : prod.availability}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                    {prod.rated_power_kw ? `${prod.rated_power_kw} kW • ` : ''}
                    {prod.product_type || prod.technology || prod.product_category || ''}
                  </p>

                  <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-100">
                    <span className="text-xs font-black text-blue-700">
                      {priceValue && priceValue > 0
                        ? `${priceValue.toLocaleString('ar-EG')} ج.م`
                        : 'حسب العرض'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleSelect(pid)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg font-bold cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                        title="تحديد هذا المنتج لإرساله مع الاستفسار"
                      >
                        {isSelected ? '✓ محدد للاستشارة' : 'تحديد للاستشارة'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenProduct(pid)}
                        className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                      >
                        <span>تفاصيل</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function EnerjooAIChat({ 
  lang = 'ar',
  isOpen: controlledIsOpen,
  onClose,
  showFloatingTrigger = false,
  activeProductId
}: EnerjooAIChatProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const handleClose = () => {
    if (isControlled) {
      onClose?.();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleOpen = () => {
    if (!isControlled) {
      setInternalIsOpen(true);
    }
  };

  // Support global custom event for opening chat seamlessly
  useEffect(() => {
    const handleGlobalOpen = () => {
      if (!isControlled) {
        setInternalIsOpen(true);
      }
    };
    window.addEventListener('open-enerjoo-ai-chat', handleGlobalOpen);
    return () => window.removeEventListener('open-enerjoo-ai-chat', handleGlobalOpen);
  }, [isControlled]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MESSAGES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter out any previous "[object Object]" error messages so the user doesn't see old error artifacts
          const cleaned = parsed.filter(m => typeof m?.text === 'string' && !m.text.includes('[object Object]'));
          if (cleaned.length > 0) {
            return cleaned;
          }
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    return INITIAL_MESSAGES;
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Persistent UUID session id for Auto-Save in Cloudflare D1
  const [sessionId, setSessionId] = useState<string>(() => {
    try {
      const storedId = localStorage.getItem(STORAGE_SESSION_KEY);
      if (isValidUUID(storedId)) {
        return storedId!;
      }
      const newId = generateUUID();
      localStorage.setItem(STORAGE_SESSION_KEY, newId);
      return newId;
    } catch {
      return generateUUID();
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync active product id when customer is viewing a specific product on website
  useEffect(() => {
    if (activeProductId && typeof activeProductId === 'string' && activeProductId.trim()) {
      const pid = activeProductId.trim();
      setSelectedProductIds(prev => prev.includes(pid) ? prev : [...prev, pid]);
    }
  }, [activeProductId]);

  // Remove any legacy default n8n DOM elements to guarantee zero duplicate launchers
  useEffect(() => {
    const purgeDefaultN8nElements = () => {
      document.querySelectorAll('#n8n-chat, .chat-window-wrapper, .chat-window-toggle, .chat-window, [class*="chat-window"]').forEach(el => {
        el.remove();
      });
    };
    purgeDefaultN8nElements();
    const interval = setInterval(purgeDefaultN8nElements, 500);
    return () => clearInterval(interval);
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages));
    } catch {
      // Ignore storage errors
    }
  }, [messages]);

  // Auto scroll to bottom of chat when new messages arrive or loading state changes
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const handleToggleSelectProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputText).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Filter out error messages and temporary messages (no loading or error bubbles in history)
      const validHistoryMessages = messages.filter(
        m => !m.isError && typeof m.text === 'string' && m.text.trim().length > 0 && m.id !== userMessage.id
      );

      // Ensure the current message is not duplicated at the end of history if retrying
      const nonDuplicatedMessages = (validHistoryMessages.length > 0 && 
        validHistoryMessages[validHistoryMessages.length - 1].sender === 'user' && 
        validHistoryMessages[validHistoryMessages.length - 1].text.trim() === text)
          ? validHistoryMessages.slice(0, -1)
          : validHistoryMessages;

      // Extract the last 10 previous messages in correct chronological order
      const history = nonDuplicatedMessages
        .slice(-10)
        .map(m => ({
          role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text
        }));

      // Format payload with message, sessionId, messageId, and history
      const messageId = userMessage.id;
      const payload: Record<string, any> = {
        message: text,
        sessionId,
        messageId,
        history
      };

      // Only send selectedProductIds when the customer actually selected products
      if (selectedProductIds.length > 0) {
        payload.selectedProductIds = selectedProductIds;
      }

      let response: Response;

      // Use the intermediary backend route /api/chat in server.ts
      try {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        // Fallback to /chat if /api/chat is not available
        if (!response.ok && response.status === 404) {
          response = await fetch('/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        }
      } catch {
        // Fallback to /chat or direct Cloudflare Worker endpoint
        try {
          response = await fetch('/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        } catch {
          response = await fetch(CF_CHAT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        }
      }

      const responseText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        // Non-JSON response
      }

      if (!response.ok) {
        throw new Error(`خطأ من Worker (HTTP ${response.status}): ${data?.error || data?.message || responseText.slice(0, 250)}`);
      }
      if (data?.ok === false) throw new Error(data?.error || data?.message || 'Worker returned ok=false');

      const returnedSessionId = data?.session_id || data?.sessionId;
      if (typeof returnedSessionId === 'string' && returnedSessionId.trim()) {
        const nextId = returnedSessionId.trim();
        setSessionId(nextId);
        try { localStorage.setItem(STORAGE_SESSION_KEY, nextId); } catch { /* Ignore storage errors */ }
      }

      if (typeof data?.reply === 'string' && data.reply.trim()) {
        const botReply: ChatMessage = {
          id: `reply-${Date.now()}`,
          sender: 'assistant',
          text: data.reply.trim(),
          timestamp: new Date().toISOString(),
          products: Array.isArray(data.products) && data.products.length ? data.products : undefined,
          recommendation: data.recommendation && typeof data.recommendation === 'object' ? data.recommendation : undefined
        };
        setMessages(prev => [...prev, botReply]);
      } else {
        throw new Error('الخادم ردّ بدون حقل reply نصي. تحقق من تنسيق استجابة الـ Worker.');
      }
    } catch (error) {
      console.error('[Enerjoo AI Chat] Request failed:', error);
      const errorDetails = error instanceof Error ? error.message : String(error);
      const isCors = /failed to fetch|networkerror|cors/i.test(errorDetails);
      const errorText = isCors
        ? 'تعذر الاتصال مباشرةً بالـ Worker. قد تكون المشكلة من إعدادات CORS في Cloudflare Worker. افتح Console في المتصفح لمعرفة التفاصيل.'
        : `تعذر الحصول على رد من مساعد Enerjoo.\n\nتفاصيل الخطأ: ${errorDetails}`;
      setMessages(prev => [
        ...prev,
        {
          id: `reply-err-${Date.now()}`,
          sender: 'assistant',
          text: errorText,
          timestamp: new Date().toISOString(),
          isError: true,
          failedPrompt: text
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSession = () => {
    const newSessionId = generateUUID();
    setSessionId(newSessionId);
    setSelectedProductIds([]);
    try {
      localStorage.setItem(STORAGE_SESSION_KEY, newSessionId);
      localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(INITIAL_MESSAGES));
    } catch {
      // Ignore
    }
    setMessages(INITIAL_MESSAGES);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to format messages with bold text and line breaks cleanly
  const renderMessageContent = (text: string) => {
    return text.split('\n').map((line, lineIdx) => {
      // Handle bold markdown **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={lineIdx} className={lineIdx > 0 ? 'mt-1.5' : ''}>
          {parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={partIdx} className="font-bold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isControlled]);

  return (
    <>
      {/* Backdrop for mobile to easily close modal when tapping outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 sm:hidden transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* 
        Custom Enerjoo AI Chat Panel / Modal
        - Preserves bottom navigation on mobile with bottom-22 gap
        - Clean floating panel on desktop
        - RTL typography and native Enerjoo styling
      */}
      {isOpen && (
        <div
          id="enerjoo-ai-chat-panel"
          dir="rtl"
          className={`fixed z-50 flex flex-col bg-white border border-slate-200/90 shadow-2xl overflow-hidden transition-all duration-300 animate-fade-in
            /* Mobile: Almost full-screen while leaving bottom navigation clearly accessible */
            inset-x-3 top-4 bottom-22 rounded-2xl
            /* Desktop / Tablet: Modern floating panel */
            sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:max-w-[calc(100vw-2rem)] sm:h-[620px] sm:max-h-[calc(100vh-5rem)] sm:rounded-3xl
          `}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white p-4 flex items-center justify-between shadow-md select-none shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-amber-300 shadow-inner">
                <Zap className="w-5 h-5 fill-amber-300 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black tracking-wide leading-none">
                    ⚡ Enerjoo AI
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    متصل
                  </span>
                </div>
                <p className="text-xs text-blue-100 font-medium mt-1 leading-none">
                  مساعدك الذكي في الطاقة الشمسية
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* New Conversation / Reset button */}
              <button
                type="button"
                onClick={handleResetSession}
                title="بدء محادثة جديدة"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={handleClose}
                title="إغلاق"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader Banner */}
          <div className="bg-blue-50/80 border-b border-blue-100/80 px-4 py-2 flex items-center justify-between text-[11px] text-blue-900 font-medium shrink-0">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              مدعوم بمحرك Enerjoo الذكي للحسابات والمواصفات
            </span>
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="inline-flex items-center gap-1 text-[10px] text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
              title="عرض سياسة الخصوصية وحفظ المحادثات"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>سياسة الخصوصية</span>
            </button>
          </div>

          {/* Privacy Policy Modal Overlay */}
          {showPrivacyModal && (
            <div className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-4 max-w-sm w-full shadow-2xl border border-slate-200 text-right space-y-3" dir="rtl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">سياسة الخصوصية وحفظ المحادثات</h4>
                      <p className="text-[10px] text-slate-500 font-medium">حماية بياناتك واستشاراتك في Enerjoo</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(false)}
                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-[11px] text-slate-600 space-y-2 leading-relaxed">
                  <p>
                    حرصاً منا على تقديم أعلى معايير الجودة والاستشارات الهندسية الدقيقة:
                  </p>
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 space-y-1.5 text-slate-700">
                    <p className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                      <span><strong>حفظ تلقائي آمن:</strong> تُحفظ جلسات المحادثة والاستفسارات مشفرة لتحسين دقة الترشيحات ومتابعة احتياجاتك دون انقطاع.</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                      <span><strong>سرية تامة:</strong> لا يتم مشاركة أو بيع أي بيانات مع جهات إعلانية أو أطراف خارجية.</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                      <span><strong>حماية المعلومات:</strong> لا تطلب المحادثة ولا تُسجل أي معلومات بنكية أو كلمات مرور أو أسرار حساسة.</span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                      <span><strong>تحكم كامل:</strong> يمكنك في أي وقت بدء جلسة جديدة وتصفير السجل عبر زر إعادة التعيين في أعلى الشات.</span>
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPrivacyModal(false)}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    إغلاق ومتابعة المحادثة
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar Icon */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-xs text-xs font-bold ${
                      isUser
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-600 border border-slate-200'
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4 text-blue-600" />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[85%] sm:max-w-[82%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-xs ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tl-xs'
                        : msg.isError
                        ? 'bg-amber-50 text-amber-950 border border-amber-200 rounded-tr-xs'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-tr-xs'
                    }`}
                  >
                    <div className="leading-relaxed whitespace-pre-wrap">
                      {renderMessageContent(msg.text)}
                    </div>

                    {/* Customer Retry Button on Error */}
                    {!isUser && msg.isError && msg.failedPrompt && (
                      <div className="mt-2.5 pt-2 border-t border-amber-200/80 flex items-center justify-start">
                        <button
                          type="button"
                          onClick={() => handleSendMessage(msg.failedPrompt)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 border border-amber-300/80 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                          <span>إعادة المحاولة</span>
                        </button>
                      </div>
                    )}

                    {/* Rich Structured Inverter Agent Recommendations & Comparison Matrix */}
                    {!isUser && msg.recommendation && (
                      <InverterRecommendationView rec={msg.recommendation} />
                    )}

                    {/* Proposed Products from Cloudflare Worker Catalog */}
                    {!isUser && msg.products && msg.products.length > 0 && (
                      <WorkerProductCardsView
                        products={msg.products}
                        selectedProductIds={selectedProductIds}
                        onToggleSelect={handleToggleSelectProduct}
                      />
                    )}

                    <div
                      className={`text-[10px] mt-1.5 font-medium ${
                        isUser ? 'text-blue-200 text-left' : 'text-slate-400 text-right'
                      }`}
                      dir="ltr"
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator Bubble */}
            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white text-blue-600 border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tr-xs px-4 py-3 shadow-xs flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-slate-500 font-medium mr-1">
                    Enerjoo AI يفكر ويحسب...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-hide shrink-0">
            {QUICK_PROMPTS.map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(promptText)}
                disabled={isLoading}
                className="text-[11px] whitespace-nowrap px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 active:bg-blue-100 text-slate-700 hover:text-blue-700 border border-slate-200/70 rounded-full transition-colors cursor-pointer disabled:opacity-50"
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Active Selected Products Indicator */}
          {selectedProductIds.length > 0 && (
            <div className="px-3 py-1.5 bg-blue-50/90 border-t border-blue-200/70 flex items-center justify-between text-[11px] text-blue-900 font-bold shrink-0">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                <span>تم تحديد {selectedProductIds.length} منتج للاستشارة الفنية</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedProductIds([])}
                className="text-[10px] text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                إلغاء التحديد
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب احتياجك هنا..."
                disabled={isLoading}
                className="w-full bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"
                dir="rtl"
              />
            </div>

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              aria-label="إرسال"
              className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 text-white disabled:text-slate-400 flex items-center justify-center transition-all transform hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:cursor-not-allowed shadow-md cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4 transform -rotate-90 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
