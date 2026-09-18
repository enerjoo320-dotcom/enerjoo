import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Loader2, AlertCircle, Plus, Trash2, Sparkles, CheckCircle2 } from 'lucide-react';
import { translations } from '../translations';
import { uploadProductImage } from '../services/uploadService';
import { autoCompressImage, formatFileSize, MAX_FINAL_IMAGE_SIZE_BYTES } from '../utils/imageCompression';
import { Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { SUPPLIER_CONTACT_PHONE_DISPLAY } from '../constants/contact';

export const ProductForm: React.FC<{ 
  lang: 'ar' | 'en'; 
  onSave: (product: Omit<Product, 'id'>) => void | Promise<void>; 
  onCancel: () => void;
  initialData?: Product | null;
}> = ({ lang, onSave, onCancel, initialData }) => {
  const t = translations[lang];
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    brand: initialData?.brand || '',
    category: (initialData?.category as string) || 'panels',
    price: initialData?.price?.toString() || '',
    phone: SUPPLIER_CONTACT_PHONE_DISPLAY,
    description: initialData?.specs?.description || '',
    // Dynamic specs
    power: initialData?.power?.toString() || '',
    powerKw: initialData?.specs?.powerKw || '',
    efficiency: initialData?.efficiency?.toString() || '',
    warranty: initialData?.warranty?.toString() || '',
    type: initialData?.specs?.type || '',
    voltage: initialData?.specs?.voltage || '',
    current: initialData?.specs?.current || '',
    weight: initialData?.specs?.weight || '',
    area: initialData?.area?.toString() || '',
    capacity: initialData?.specs?.capacity || '',
    crossSection: initialData?.specs?.crossSection || '',
    length: initialData?.specs?.length || '',
    material: initialData?.specs?.material || '',
    maxWind: initialData?.specs?.maxWind || '',
    ipRating: initialData?.specs?.ipRating || '',
    poles: initialData?.specs?.poles || '',
    quantity: initialData?.specs?.quantity || '',
    color: initialData?.specs?.color || '',
    status: initialData?.status || 'available',
  });

  const getFieldsForCategory = (cat: string) => {
    const common = ['price', 'warranty'];
    switch (cat) {
      case 'panels':
        return [...common, 'power', 'efficiency', 'type', 'voltage', 'current', 'area', 'weight'];
      case 'inverters':
        return [...common, 'powerKw', 'efficiency', 'type', 'voltage', 'current', 'weight'];
      case 'batteries':
        return [...common, 'capacity', 'voltage', 'type', 'weight'];
      case 'cables':
        return ['price', 'crossSection', 'length', 'voltage', 'material', 'color'];
      case 'mounting':
        return ['price', 'material', 'maxWind', 'warranty'];
      case 'protection':
        return ['price', 'poles', 'current', 'voltage', 'type'];
      case 'combiner':
        return ['price', 'ipRating', 'poles', 'voltage', 'current'];
      case 'mc4':
      case 'sealings':
      case 'clamps':
        return ['price', 'quantity', 'material', 'type'];
      default:
        return [...common, 'power', 'efficiency', 'type'];
    }
  };

  const fields = getFieldsForCategory(formData.category);

  // Main product image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialData?.image || null);
  const [isCompressingMain, setIsCompressingMain] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<string | null>(null);
  const [imageSizeInfo, setImageSizeInfo] = useState<string | null>(null);

  // Additional product images state
  const [additionalFiles, setAdditionalFiles] = useState<Array<{
    id: string;
    file: File;
    preview: string;
    sizeInfo?: string;
  }>>([]);
  const [existingAdditionalUrls, setExistingAdditionalUrls] = useState<string[]>(
    initialData?.additionalImages || []
  );
  const [isCompressingAdditional, setIsCompressingAdditional] = useState(false);
  const additionalInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleImageClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const ext = selected.name.split('.').pop()?.toLowerCase() || '';
      const isAllowed = allowed.includes(selected.type.toLowerCase()) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

      if (!isAllowed) {
        setUploadError(lang === 'ar' ? 'نوع الملف غير مدعوم. يرجى اختيار صورة JPG أو PNG أو WebP.' : 'Invalid file type. Only JPG, JPEG, PNG, and WebP are allowed.');
        return;
      }

      setUploadError(null);

      // Requirement: Do NOT reject images larger than 5 MB.
      // If <= 5 MB: Upload normally without unnecessary compression.
      // If > 5 MB: Automatically compress before uploading.
      if (selected.size > MAX_FINAL_IMAGE_SIZE_BYTES) {
        setIsCompressingMain(true);
        const defaultMsg = lang === 'ar' ? 'جاري تحسين وضغط الصورة قبل الرفع...' : 'Optimizing and compressing image before upload...';
        setCompressionStatus(defaultMsg);

        try {
          // Immediate visual preview while compression completes
          const tempUrl = URL.createObjectURL(selected);
          setImagePreview(tempUrl);

          const result = await autoCompressImage(selected, {
            lang,
            onStatusChange: (status) => setCompressionStatus(status),
          });

          setImageFile(result.file);
          const compressedUrl = URL.createObjectURL(result.file);
          setImagePreview(compressedUrl);
          setImageSizeInfo(
            `${formatFileSize(result.originalSize)} ← ${formatFileSize(result.compressedSize)} (${lang === 'ar' ? 'تم الضغط بنجاح' : 'Optimized'})`
          );
        } catch (compErr) {
          console.error('Compression error:', compErr);
          setImageFile(selected);
        } finally {
          setIsCompressingMain(false);
          setCompressionStatus(null);
        }
      } else {
        setImageFile(selected);
        try {
          const previewUrl = URL.createObjectURL(selected);
          setImagePreview(previewUrl);
          setImageSizeInfo(formatFileSize(selected.size));
        } catch {
          // fallback
        }
      }
    }
  };

  const handleAdditionalImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = Array.from(e.target.files);
      setIsCompressingAdditional(true);
      const defaultMsg = lang === 'ar' ? 'جاري تحسين وضغط الصورة قبل الرفع...' : 'Optimizing and compressing image before upload...';
      setCompressionStatus(defaultMsg);

      try {
        const newItems: Array<{ id: string; file: File; preview: string; sizeInfo?: string }> = [];

        for (const rawFile of files) {
          const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
          const ext = rawFile.name.split('.').pop()?.toLowerCase() || '';
          const isAllowed = allowed.includes(rawFile.type.toLowerCase()) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
          if (!isAllowed) continue;

          const id = Math.random().toString(36).substring(2, 9);

          if (rawFile.size > MAX_FINAL_IMAGE_SIZE_BYTES) {
            const result = await autoCompressImage(rawFile, {
              lang,
              onStatusChange: (status) => setCompressionStatus(status),
            });
            newItems.push({
              id,
              file: result.file,
              preview: URL.createObjectURL(result.file),
              sizeInfo: `${formatFileSize(result.originalSize)} ← ${formatFileSize(result.compressedSize)}`,
            });
          } else {
            newItems.push({
              id,
              file: rawFile,
              preview: URL.createObjectURL(rawFile),
              sizeInfo: formatFileSize(rawFile.size),
            });
          }
        }

        setAdditionalFiles((prev) => [...prev, ...newItems]);
      } catch (err) {
        console.error('Error handling additional images:', err);
      } finally {
        setIsCompressingAdditional(false);
        setCompressionStatus(null);
        if (additionalInputRef.current) {
          additionalInputRef.current.value = '';
        }
      }
    }
  };

  const handleRemoveAdditional = (id: string) => {
    setAdditionalFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRemoveExistingAdditional = (index: number) => {
    setExistingAdditionalUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user?.type === 'supplier' && !user?.verified) {
      alert(lang === 'ar' ? 'بصفتك مورداً، يجب التحقق من حسابك والموافقة عليه قبل التمكن من نشر المنتجات.' : 'As a supplier, your account must be verified and approved by admin before you can publish products.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    
    try {
      let imageUrl = initialData?.image || (initialData as any)?.image_url || '';
      // Preserve existing datasheet if product previously had one, without adding PDF upload UI
      const datasheetUrl = initialData?.datasheetUrl || '';

      // Upload main product image if selected (auto-compressed if > 5MB)
      if (imageFile) {
        imageUrl = await uploadProductImage(imageFile, (status) => setCompressionStatus(status), lang);
      }

      // Upload any additional product images
      const finalAdditionalUrls = [...existingAdditionalUrls];
      for (const item of additionalFiles) {
        const uploadedUrl = await uploadProductImage(item.file, (status) => setCompressionStatus(status), lang);
        if (uploadedUrl) {
          finalAdditionalUrls.push(uploadedUrl);
        }
      }

      const newProduct: any = {
        name: formData.name,
        nameAr: formData.name,
        brand: formData.brand,
        category: formData.category as any,
        price: parseInt(formData.price) || 0,
        power: parseInt(formData.power) || 0,
        efficiency: parseFloat(formData.efficiency) || 0,
        warranty: parseInt(formData.warranty) || 0,
        image: imageUrl || 'https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=2944&auto=format&fit=crop',
        image_url: imageUrl || 'https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=2944&auto=format&fit=crop',
        additionalImages: finalAdditionalUrls,
        datasheetUrl: datasheetUrl,
        area: parseFloat(formData.area) || 0,
        status: formData.status as any,
        updatedAt: new Date().toLocaleDateString(),
        supplierId: initialData?.supplierId || user?.uid || '',
        specs: {
          description: formData.description,
          type: formData.type,
          voltage: formData.voltage,
          current: formData.current,
          weight: formData.weight,
          capacity: formData.capacity,
          powerKw: formData.powerKw,
          crossSection: formData.crossSection,
          length: formData.length,
          material: formData.material,
          maxWind: formData.maxWind,
          ipRating: formData.ipRating,
          poles: formData.poles,
          quantity: formData.quantity,
          color: formData.color,
        },
        suppliers: [
          {
            id: user?.uid || initialData?.supplierId || '',
            name: user?.name || 'New Supplier',
            nameAr: user?.nameAr || 'مورد جديد',
            price: parseInt(formData.price) || 0,
            phone: SUPPLIER_CONTACT_PHONE_DISPLAY,
            location: user?.location || 'Cairo, Egypt',
            verified: user?.verified || false,
            lastUpdate: new Date().toLocaleDateString()
          }
        ]
      };
      
      await onSave(newProduct);
    } catch (error: any) {
      console.error("Upload failed", error);
      setUploadError(error.message || (lang === 'ar' ? 'حدث خطأ أثناء رفع صورة المنتج إلى Cloudflare R2' : 'Failed to upload product image to Cloudflare R2'));
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <form className="space-y-6 text-right" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
        <div className="space-y-2 md:col-span-2 text-left">
          <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.productName}</label>
          <input 
            value={formData.name}
            onChange={e => setFormData(p => ({...p, name: e.target.value}))}
            className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
            placeholder={lang === 'ar' ? 'مثال: لوح شمسي جينكو 580 واط' : 'e.g., Jinko Solar 580W'}
            required
          />
        </div>
        <div className="space-y-2 text-left">
          <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.brand}</label>
          <input 
            value={formData.brand}
            onChange={e => setFormData(p => ({...p, brand: e.target.value}))}
            className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
            required
          />
        </div>
        <div className="space-y-2 text-left">
          <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.category}</label>
          <select 
            value={formData.category}
            onChange={e => setFormData(p => ({...p, category: e.target.value}))}
            className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text"
          >
            <option value="panels">{t.panels}</option>
            <option value="inverters">{t.inverters}</option>
            <option value="batteries">{t.batteries}</option>
            <option value="mounting">{t.mounting}</option>
            <option value="protection">{t.protection}</option>
            <option value="combiner">{t.combiner}</option>
            <option value="cables">{t.cables}</option>
            <option value="mc4">{t.mc4}</option>
            <option value="sealings">{t.sealings}</option>
            <option value="clamps">{t.clamps}</option>
          </select>
        </div>

        <div className="space-y-2 text-left">
          <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.status}</label>
          <select 
            value={formData.status}
            onChange={e => setFormData(p => ({...p, status: e.target.value}))}
            className={`w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold flex items-center gap-2 ${
              formData.status === 'available' ? 'text-solar-success' : 
              formData.status === 'limited' ? 'text-amber-500' : 'text-red-500'
            }`}
          >
            <option value="available">🟢 {t.available}</option>
            <option value="limited">🟡 {t.limited}</option>
            <option value="out_of_stock">🔴 {t.out_of_stock}</option>
          </select>
        </div>

        {fields.includes('price') && (
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1">{t.price}</label>
            <input 
              type="number" 
              inputMode="numeric"
              value={formData.price}
              onChange={e => setFormData(p => ({...p, price: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 min-h-[48px] text-base sm:text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              required
            />
          </div>
        )}

        {fields.includes('power') && (
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1">{t.power}</label>
            <input 
              type="number" 
              inputMode="numeric"
              value={formData.power}
              onChange={e => setFormData(p => ({...p, power: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 min-h-[48px] text-base sm:text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              required
            />
          </div>
        )}

        {fields.includes('powerKw') && (
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1">{t.powerKw}</label>
            <input 
              type="text" 
              value={formData.powerKw}
              onChange={e => setFormData(p => ({...p, powerKw: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 min-h-[48px] text-base sm:text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="5kW"
              required
            />
          </div>
        )}

        {fields.includes('capacity') && (
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1">{t.capacity}</label>
            <input 
              type="text" 
              value={formData.capacity}
              onChange={e => setFormData(p => ({...p, capacity: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 min-h-[48px] text-base sm:text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="200Ah"
              required
            />
          </div>
        )}

        {fields.includes('efficiency') && (
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1">{t.efficiency}</label>
            <input 
              type="number" 
              inputMode="decimal"
              step="0.01" 
              value={formData.efficiency}
              onChange={e => setFormData(p => ({...p, efficiency: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 min-h-[48px] text-base sm:text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              required
            />
          </div>
        )}

        {fields.includes('warranty') && (
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1">{t.warrantyYears}</label>
            <input 
              type="number" 
              inputMode="numeric"
              value={formData.warranty}
              onChange={e => setFormData(p => ({...p, warranty: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 min-h-[48px] text-base sm:text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              required
            />
          </div>
        )}

        {fields.includes('type') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.type}</label>
            <input 
              type="text" 
              value={formData.type}
              onChange={e => setFormData(p => ({...p, type: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="Monocrystalline / Hybrid / Gel"
              required
            />
          </div>
        )}

        {fields.includes('voltage') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.voltage}</label>
            <input 
              type="text" 
              value={formData.voltage}
              onChange={e => setFormData(p => ({...p, voltage: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="48V / 220V"
              required
            />
          </div>
        )}

        {fields.includes('current') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.current}</label>
            <input 
              type="text" 
              value={formData.current}
              onChange={e => setFormData(p => ({...p, current: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="10.85A"
              required
            />
          </div>
        )}

        {fields.includes('crossSection') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.crossSection}</label>
            <input 
              type="text" 
              value={formData.crossSection}
              onChange={e => setFormData(p => ({...p, crossSection: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="4mm² / 6mm²"
              required
            />
          </div>
        )}

        {fields.includes('length') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.length}</label>
            <input 
              type="text" 
              value={formData.length}
              onChange={e => setFormData(p => ({...p, length: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="100m"
              required
            />
          </div>
        )}

        {fields.includes('material') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.material}</label>
            <input 
              type="text" 
              value={formData.material}
              onChange={e => setFormData(p => ({...p, material: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="Aluminum / Copper"
              required
            />
          </div>
        )}

        {fields.includes('color') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.color}</label>
            <input 
              type="text" 
              value={formData.color}
              onChange={e => setFormData(p => ({...p, color: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="Black / Red"
              required
            />
          </div>
        )}

        {fields.includes('maxWind') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.maxWind}</label>
            <input 
              type="text" 
              value={formData.maxWind}
              onChange={e => setFormData(p => ({...p, maxWind: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="120km/h"
              required
            />
          </div>
        )}

        {fields.includes('ipRating') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.ipRating}</label>
            <input 
              type="text" 
              value={formData.ipRating}
              onChange={e => setFormData(p => ({...p, ipRating: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="IP65 / IP67"
              required
            />
          </div>
        )}

        {fields.includes('poles') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.poles}</label>
            <input 
              type="text" 
              value={formData.poles}
              onChange={e => setFormData(p => ({...p, poles: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="2P / 4P"
              required
            />
          </div>
        )}

        {fields.includes('quantity') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.quantityValue}</label>
            <input 
              type="text" 
              value={formData.quantity}
              onChange={e => setFormData(p => ({...p, quantity: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="100 pcs"
              required
            />
          </div>
        )}

        {fields.includes('weight') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.weight}</label>
            <input 
              type="text" 
              value={formData.weight}
              onChange={e => setFormData(p => ({...p, weight: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="23kg"
              required
            />
          </div>
        )}
        {fields.includes('area') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.area}</label>
            <input 
              type="number" 
              step="0.01"
              value={formData.area}
              onChange={e => setFormData(p => ({...p, area: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="2.1"
              required
            />
          </div>
        )}
      </div>

      <div className="space-y-2 text-left">
        <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.description}</label>
        <textarea 
          value={formData.description}
          onChange={e => setFormData(p => ({...p, description: e.target.value}))}
          className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold h-24 text-solar-text" 
        />
      </div>

      <div className="w-full space-y-4">
        {/* Main Product Image */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">
              {lang === 'ar' ? 'صورة المنتج الرئيسية' : 'Main Product Image'}
            </label>
            <span className="text-[10px] font-bold text-solar-blue">
              {lang === 'ar' ? 'الحد الأقصى للملف النهائي 5 ميجابايت' : 'Max final size: 5 MB'}
            </span>
          </div>

          <div 
            onClick={handleImageClick}
            className="border-2 border-dashed border-solar-border rounded-2xl p-5 flex flex-col items-center justify-center gap-3 hover:border-solar-blue transition cursor-pointer bg-solar-bg/30 relative overflow-hidden group"
          >
            <input 
              type="file" 
              ref={imageInputRef} 
              onChange={handleImageChange} 
              accept="image/jpeg,image/jpg,image/png,image/webp" 
              className="hidden" 
            />

            {isCompressingMain ? (
              <div className="flex flex-col items-center justify-center gap-2.5 py-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-solar-blue/10 flex items-center justify-center text-solar-blue">
                  <Loader2 size={22} className="animate-spin" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-solar-blue animate-pulse">
                    {compressionStatus || (lang === 'ar' ? 'جاري تحسين وضغط الصورة قبل الرفع...' : 'Optimizing and compressing image before upload...')}
                  </p>
                  <p className="text-[10px] text-solar-muted font-bold">
                    {lang === 'ar' ? 'يتم تقليل الحجم لأقل من 5 ميجابايت مع الحفاظ على أعلى جودة' : 'Reducing size to <= 5 MB while preserving highest quality'}
                  </p>
                </div>
              </div>
            ) : imagePreview ? (
              <div className="flex items-center gap-3 w-full max-w-md">
                <img 
                  src={imagePreview} 
                  alt="Product preview" 
                  className="w-16 h-16 object-cover rounded-xl border border-solar-border shadow-sm shrink-0" 
                />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold text-solar-text truncate">
                    {imageFile ? imageFile.name : (lang === 'ar' ? 'صورة المنتج الحالية' : 'Current Product Image')}
                  </p>
                  {imageSizeInfo && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={13} className="shrink-0" />
                      <span>{imageSizeInfo}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-solar-blue font-semibold mt-1 hover:underline">
                    {lang === 'ar' ? 'اضغط لتغيير أو استبدال الصورة' : 'Click to replace image'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-solar-border group-hover:scale-105 transition-transform">
                  <ImageIcon size={24} className="text-solar-blue" />
                </div>
                <span className="text-xs font-bold text-solar-muted text-center max-w-[250px] truncate">
                  {t.dragImage}
                </span>
              </>
            )}

            <div className="text-center">
              <span className="text-[10px] text-solar-muted/80 block">
                {lang === 'ar' 
                  ? 'الصور المدعومة: JPG, PNG, WebP (الصور أكبر من 5MB تُضغط تلقائياً)' 
                  : 'Supported: JPG, PNG, WebP (Images > 5MB are auto-compressed)'}
              </span>
            </div>
          </div>
        </div>

        {/* Additional Product Images (Gallery) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">
              {lang === 'ar' ? 'صور إضافية للمنتج (اختياري)' : 'Additional Product Images (Optional)'}
            </label>
            <button
              type="button"
              onClick={() => additionalInputRef.current?.click()}
              className="text-[11px] font-bold text-solar-blue hover:text-solar-blue/80 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-solar-blue/5 transition"
            >
              <Plus size={14} />
              <span>{lang === 'ar' ? 'إضافة صورة إضافية' : 'Add Image'}</span>
            </button>
          </div>

          <input 
            type="file" 
            ref={additionalInputRef} 
            onChange={handleAdditionalImagesChange} 
            accept="image/jpeg,image/jpg,image/png,image/webp" 
            multiple
            className="hidden" 
          />

          {isCompressingAdditional && (
            <div className="p-3 mb-2 bg-solar-blue/5 border border-solar-blue/20 rounded-xl flex items-center gap-2 text-xs font-bold text-solar-blue">
              <Loader2 size={16} className="animate-spin shrink-0" />
              <span>{compressionStatus || (lang === 'ar' ? 'جاري تحسين وضغط الصورة قبل الرفع...' : 'Optimizing and compressing image before upload...')}</span>
            </div>
          )}

          {/* Thumbnails of additional images */}
          {(existingAdditionalUrls.length > 0 || additionalFiles.length > 0) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {existingAdditionalUrls.map((url, idx) => (
                <div key={`existing-${idx}`} className="relative group rounded-xl overflow-hidden border border-solar-border bg-solar-bg/50 aspect-video">
                  <img src={url} alt={`Additional ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveExistingAdditional(idx)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white hover:bg-red-600 transition"
                    title={lang === 'ar' ? 'حذف الصورة' : 'Remove image'}
                  >
                    <Trash2 size={12} />
                  </button>
                  <span className="absolute bottom-1 left-1.5 text-[9px] font-bold text-white/90 bg-black/50 px-1.5 py-0.5 rounded">
                    {lang === 'ar' ? 'مرفوعة' : 'Saved'}
                  </span>
                </div>
              ))}

              {additionalFiles.map((item) => (
                <div key={item.id} className="relative group rounded-xl overflow-hidden border border-solar-border bg-solar-bg/50 aspect-video">
                  <img src={item.preview} alt="New additional" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveAdditional(item.id)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white hover:bg-red-600 transition"
                    title={lang === 'ar' ? 'حذف الصورة' : 'Remove image'}
                  >
                    <Trash2 size={12} />
                  </button>
                  {item.sizeInfo && (
                    <span className="absolute bottom-1 left-1.5 text-[9px] font-bold text-emerald-300 bg-black/60 px-1.5 py-0.5 rounded truncate max-w-[90%]">
                      {item.sizeInfo}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">{uploadError}</p>
            <p className="text-[10px] opacity-80 mt-1">
              {lang === 'ar' ? 'يمكنك إعادة المحاولة أو الضغط على حفظ مرة أخرى.' : 'You can try again or click submit once more.'}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-4 pt-4">
        <button 
          type="submit" 
          disabled={isUploading || isCompressingMain || isCompressingAdditional}
          className="flex-1 bg-solar-blue text-white py-4 rounded-2xl font-black shadow-lg shadow-solar-blue/20 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {(isUploading || isCompressingMain || isCompressingAdditional) && <Loader2 size={20} className="animate-spin" />}
          {isCompressingMain || isCompressingAdditional 
            ? (lang === 'ar' ? 'جاري تحسين وضغط الصورة قبل الرفع...' : 'Compressing image...')
            : isUploading 
            ? t.uploading 
            : t.submit}
        </button>
        <button 
          type="button" 
          onClick={onCancel} 
          disabled={isUploading || isCompressingMain || isCompressingAdditional}
          className="flex-1 bg-solar-bg border border-solar-border text-solar-muted py-4 rounded-2xl font-black transition active:scale-95 disabled:opacity-50"
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
};
