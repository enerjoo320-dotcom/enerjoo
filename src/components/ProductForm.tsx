import React, { useRef, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { translations } from '../translations';
import { uploadFile } from '../services/uploadService';
import { Product } from '../types';
import { useAuth } from '../context/AuthContext';

export const ProductForm: React.FC<{ 
  lang: 'ar' | 'en'; 
  onSave: (product: Omit<Product, 'id'>) => void; 
  onCancel: () => void;
  initialData?: Product | null;
}> = ({ lang, onSave, onCancel, initialData }) => {
  const t = translations[lang];
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    brand: initialData?.brand || '',
    category: (initialData?.category as string) || 'panels',
    price: initialData?.price?.toString() || '',
    phone: initialData?.suppliers?.[0]?.phone || user?.phone || '',
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
    const common = ['price', 'warranty', 'phone'];
    switch (cat) {
      case 'panels':
        return [...common, 'power', 'efficiency', 'type', 'voltage', 'current', 'area', 'weight'];
      case 'inverters':
        return [...common, 'powerKw', 'efficiency', 'type', 'voltage', 'current', 'weight'];
      case 'batteries':
        return [...common, 'capacity', 'voltage', 'type', 'weight'];
      case 'cables':
        return ['price', 'crossSection', 'length', 'voltage', 'material', 'color', 'phone'];
      case 'mounting':
        return ['price', 'material', 'maxWind', 'warranty', 'phone'];
      case 'protection':
        return ['price', 'poles', 'current', 'voltage', 'type', 'phone'];
      case 'combiner':
        return ['price', 'ipRating', 'poles', 'voltage', 'current', 'phone'];
      case 'mc4':
      case 'sealings':
      case 'clamps':
        return ['price', 'quantity', 'material', 'type', 'phone'];
      default:
        return [...common, 'power', 'efficiency', 'type'];
    }
  };

  const fields = getFieldsForCategory(formData.category);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageClick = () => {
    imageInputRef.current?.click();
  };

  const handlePdfClick = () => {
    pdfInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (user?.type === 'supplier' && !user?.verified) {
      alert(lang === 'ar' ? 'بصفتك مورداً، يجب التحقق من حسابك والموافقة عليه قبل التمكن من نشر المنتجات.' : 'As a supplier, your account must be verified and approved by admin before you can publish products.');
      return;
    }

    setIsUploading(true);
    
    try {
      let imageUrl = initialData?.image || '';
      let datasheetUrl = initialData?.datasheetUrl || '';

      if (imageFile) {
        imageUrl = await uploadFile(imageFile);
      }
      
      if (pdfFile) {
        datasheetUrl = await uploadFile(pdfFile);
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
        datasheetUrl: datasheetUrl,
        area: parseFloat(formData.area) || 0,
        status: formData.status as any,
        updatedAt: new Date().toLocaleDateString(),
        supplierId: user?.uid || '',
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
            id: user?.uid || '',
            name: user?.name || 'New Supplier',
            nameAr: user?.nameAr || 'مورد جديد',
            price: parseInt(formData.price) || 0,
            phone: formData.phone,
            location: user?.location || 'Cairo, Egypt',
            verified: user?.verified || false,
            lastUpdate: new Date().toLocaleDateString()
          }
        ]
      };
      
      onSave(newProduct);
    } catch (error) {
      console.error("Upload failed", error);
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
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.price}</label>
            <input 
              type="number" 
              value={formData.price}
              onChange={e => setFormData(p => ({...p, price: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              required
            />
          </div>
        )}

        {fields.includes('power') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.power}</label>
            <input 
              type="number" 
              value={formData.power}
              onChange={e => setFormData(p => ({...p, power: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              required
            />
          </div>
        )}

        {fields.includes('powerKw') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.powerKw}</label>
            <input 
              type="text" 
              value={formData.powerKw}
              onChange={e => setFormData(p => ({...p, powerKw: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="5kW"
              required
            />
          </div>
        )}

        {fields.includes('capacity') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.capacity}</label>
            <input 
              type="text" 
              value={formData.capacity}
              onChange={e => setFormData(p => ({...p, capacity: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="200Ah"
              required
            />
          </div>
        )}

        {fields.includes('efficiency') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.efficiency}</label>
            <input 
              type="number" 
              step="0.01" 
              value={formData.efficiency}
              onChange={e => setFormData(p => ({...p, efficiency: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              required
            />
          </div>
        )}

        {fields.includes('warranty') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{t.warrantyYears}</label>
            <input 
              type="number" 
              value={formData.warranty}
              onChange={e => setFormData(p => ({...p, warranty: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
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
        {fields.includes('phone') && (
          <div className="space-y-2 text-left">
            <label className="text-[10px] font-black text-solar-muted uppercase ml-2">{lang === 'ar' ? 'رقم الهاتف (الواتساب)' : 'Phone (WhatsApp)'}</label>
            <input 
              type="text" 
              value={formData.phone}
              onChange={e => setFormData(p => ({...p, phone: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder="+201234567890"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={handleImageClick}
          className="border-2 border-dashed border-solar-border rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-solar-blue transition cursor-pointer bg-solar-bg/30"
        >
          <input 
            type="file" 
            ref={imageInputRef} 
            onChange={handleImageChange} 
            accept="image/*" 
            className="hidden" 
          />
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-solar-border">
            <ImageIcon size={24} className="text-solar-blue" />
          </div>
          <span className="text-xs font-bold text-solar-muted text-center max-w-[150px] truncate">{imageFile ? imageFile.name : t.dragImage}</span>
        </div>

        <div 
          onClick={handlePdfClick}
          className="border-2 border-dashed border-solar-border rounded-2xl p-6 flex flex-col items-center justify-center gap-3 hover:border-solar-blue transition cursor-pointer bg-solar-bg/30"
        >
          <input 
            type="file" 
            ref={pdfInputRef} 
            onChange={handlePdfChange} 
            accept=".pdf" 
            className="hidden" 
          />
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-solar-border">
            <FileText size={24} className="text-solar-danger" />
          </div>
          <span className="text-xs font-bold text-solar-muted text-center max-w-[150px] truncate">{pdfFile ? pdfFile.name : t.downloadPDF}</span>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button 
          type="submit" 
          disabled={isUploading}
          className="flex-1 bg-solar-blue text-white py-4 rounded-2xl font-black shadow-lg shadow-solar-blue/20 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isUploading && <Loader2 size={20} className="animate-spin" />}
          {isUploading ? t.uploading : t.submit}
        </button>
        <button 
          type="button" 
          onClick={onCancel} 
          disabled={isUploading}
          className="flex-1 bg-solar-bg border border-solar-border text-solar-muted py-4 rounded-2xl font-black transition active:scale-95 disabled:opacity-50"
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
};
