import React, { useRef, useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Loader2, AlertCircle, Plus, Trash2, Sparkles, CheckCircle2, Ruler, Maximize2, Calculator, Zap } from 'lucide-react';
import { translations } from '../translations';
import { uploadProductImage } from '../services/uploadService';
import { autoCompressImage, formatFileSize, MAX_FINAL_IMAGE_SIZE_BYTES } from '../utils/imageCompression';
import { Product } from '../types';
import { parseDimensionsString } from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { SUPPLIER_CONTACT_PHONE_DISPLAY } from '../constants/contact';
import { isRawUidOrId } from '../utils/supplierUtils';

const normalizeCategory = (cat?: string): string => {
  if (!cat) return 'panels';
  const c = cat.toLowerCase();
  if (c.includes('panel')) return 'panels';
  if (c.includes('invert')) return 'inverters';
  if (c.includes('batter')) return 'batteries';
  if (c.includes('mount') || c.includes('structur')) return 'mounting';
  if (c.includes('protect')) return 'protection';
  if (c.includes('combin')) return 'combiner';
  if (c.includes('cable')) return 'cables';
  if (c.includes('mc4')) return 'mc4';
  if (c.includes('seal')) return 'sealings';
  if (c.includes('clamp')) return 'clamps';
  return c;
};

const extractInitialFormData = (data?: Product | null) => {
  if (!data) {
    return {
      name: '',
      brand: '',
      category: 'panels',
      price: '',
      phone: SUPPLIER_CONTACT_PHONE_DISPLAY,
      description: '',
      power: '',
      powerKw: '',
      efficiency: '',
      warranty: '',
      type: '',
      voltage: '',
      current: '',
      weight: '',
      capacity: '',
      crossSection: '',
      length: '',
      material: '',
      maxWind: '',
      ipRating: '',
      poles: '',
      quantity: '',
      color: '',
      status: 'available' as const,
      dimLength: '',
      dimWidth: '',
      dimThickness: '',
      dimensionUnit: 'mm' as 'mm' | 'cm' | 'm',
      area: '',
    };
  }

  const category = normalizeCategory(data.category as string);
  const specs = data.specs || {};

  // Extract power in Watts or kW
  let power = '';
  let powerKw = '';
  if (data.power !== undefined && data.power !== null && data.power > 0) {
    power = data.power.toString();
    powerKw = (data.power / 1000).toString();
  }
  if (specs.power !== undefined && specs.power !== null && specs.power !== '') {
    power = specs.power.toString();
  }
  if (specs.powerKw !== undefined && specs.powerKw !== null && specs.powerKw !== '') {
    powerKw = specs.powerKw.toString();
    if (!power) power = (parseFloat(specs.powerKw) * 1000).toString();
  }
  if (specs.ratedPowerKw !== undefined && specs.ratedPowerKw !== null && specs.ratedPowerKw !== '') {
    powerKw = specs.ratedPowerKw.toString();
    if (!power) power = (parseFloat(specs.ratedPowerKw) * 1000).toString();
  }

  // Extract voltage
  const voltage = (
    specs.voltage ||
    specs.vmpV ||
    specs.nominalVoltage ||
    specs.acVoltageV ||
    (data as any).vmp_v ||
    (data as any).nominal_voltage_v ||
    (data as any).ac_voltage_v ||
    ''
  ).toString();

  // Extract current
  const current = (
    specs.current ||
    specs.impA ||
    specs.maxContinuousDischargeCurrentA ||
    (data as any).imp_a ||
    (data as any).isc_a ||
    ''
  ).toString();

  // Extract weight
  const weight = (
    specs.weight ||
    specs.weightKg ||
    (data as any).weight_kg ||
    ''
  ).toString();

  // Extract capacity
  const capacity = (
    specs.capacity ||
    specs.capacityAh ||
    (data as any).capacity_ah ||
    ''
  ).toString();

  // Extract type
  const type = (
    specs.type ||
    specs.productType ||
    specs.technology ||
    specs.cellType ||
    (data as any).product_type ||
    (data as any).technology ||
    ''
  ).toString();

  // Extract MPPT voltage range
  const mppt = (
    specs.pvMpptVoltageRangeV ||
    specs.mppt ||
    specs.mpptVoltageRange ||
    (data as any).pv_mppt_voltage_range_v ||
    (data as any).mppt ||
    ''
  ).toString();

  // Extract description
  const description = (
    data.description ||
    data.notes ||
    specs.description ||
    specs.notes ||
    (data as any).notes ||
    (data as any).description ||
    ''
  ).toString();

  // Extract efficiency
  let efficiency = '';
  if (data.efficiency !== undefined && data.efficiency !== null && data.efficiency > 0) {
    efficiency = data.efficiency.toString();
  } else if (specs.efficiency !== undefined && specs.efficiency !== null && specs.efficiency !== '') {
    efficiency = specs.efficiency.toString();
  } else if (specs.peakEfficiency !== undefined && specs.peakEfficiency !== null && specs.peakEfficiency !== '') {
    efficiency = specs.peakEfficiency.toString();
  } else if ((data as any).efficiency_percent !== undefined && (data as any).efficiency_percent !== null) {
    efficiency = (data as any).efficiency_percent.toString();
  }

  // Extract warranty
  let warranty = '';
  if (data.warranty !== undefined && data.warranty !== null && data.warranty > 0) {
    warranty = data.warranty.toString();
  } else if (specs.warranty !== undefined && specs.warranty !== null && specs.warranty !== '') {
    warranty = specs.warranty.toString();
  } else if ((data as any).warranty_years !== undefined && (data as any).warranty_years !== null) {
    warranty = (data as any).warranty_years.toString();
  }

  // Dimensions
  let dimLength = data.length !== undefined && data.length !== null
    ? data.length.toString()
    : (specs.length && category !== 'cables' ? specs.length.toString() : '');
  let dimWidth = data.width !== undefined && data.width !== null
    ? data.width.toString()
    : (specs.width ? specs.width.toString() : '');
  let dimThickness = data.thickness !== undefined && data.thickness !== null
    ? data.thickness.toString()
    : (specs.thickness ? specs.thickness.toString() : '');
  let dimensionUnit = ((data.dimensionUnit || specs.dimensionUnit || 'mm') as 'mm' | 'cm' | 'm');
  let area = data.area !== undefined && data.area !== null
    ? data.area.toString()
    : (specs.area ? specs.area.toString() : '');

  // Fallback parsing for dimensions string if length/width are missing
  if (!dimLength || !dimWidth) {
    const rawDimStr = (data as any).dimensions_mm || specs.dimensionsMm || (data as any).dimensions;
    if (rawDimStr) {
      const parsed = parseDimensionsString(rawDimStr);
      if (parsed.length && !dimLength) dimLength = parsed.length.toString();
      if (parsed.width && !dimWidth) dimWidth = parsed.width.toString();
      if (parsed.thickness && !dimThickness) dimThickness = parsed.thickness.toString();
      if (parsed.dimensionUnit) dimensionUnit = parsed.dimensionUnit;
      if (parsed.area && !area) area = parsed.area.toString();
    }
  }

  // Heuristic auto-fallback for known models if technical specs were empty
  let finalType = type;
  let finalVoltage = voltage;
  let finalCurrent = current;
  let finalWeight = weight;
  let finalMppt = mppt;
  let finalDescription = description;

  const prodNameLower = ((data.name || '') + ' ' + (data.nameAr || '') + ' ' + ((data as any).model || '') + ' ' + (data.brand || '')).toLowerCase();
  if (category === 'panels' && (prodNameLower.includes('620') || prodNameLower.includes('66hl4m') || prodNameLower.includes('jinco') || prodNameLower.includes('jinko'))) {
    if (!finalType) finalType = 'Monocrystalline N-type';
    if (!finalVoltage) finalVoltage = '41.5';
    if (!finalCurrent) finalCurrent = '14.94';
    if (!finalWeight) finalWeight = '28';
    if (!dimLength) dimLength = '2384';
    if (!dimWidth) dimWidth = '1303';
    if (!dimThickness) dimThickness = '35';
    if (!area) area = '3.106';
    if (!finalDescription) finalDescription = 'لوح شمسي عالي الكفاءة بقدرة 620 واط بتقنية N-type TOPCon مناسب للمشاريع السكنية والتجارية ومحطات الطاقة الشمسية.';
  } else if (category === 'inverters' && (prodNameLower.includes('sun2000') || prodNameLower.includes('huawei'))) {
    if (!finalType) finalType = 'Three Phase On-Grid Inverter';
    if (!finalVoltage) finalVoltage = '380/400';
    if (!finalCurrent) finalCurrent = '8.5';
    if (!finalWeight) finalWeight = '17';
    if (!dimLength) dimLength = '525';
    if (!dimWidth) dimWidth = '470';
    if (!dimThickness) dimThickness = '146';
    if (!finalMppt) finalMppt = '160 - 950 V (2 MPPT)';
    if (!finalDescription) finalDescription = 'محول طاقة شمسية ذكي ثلاثي الأوجه بقدرة 5 كيلوواط من هواوي بكفاءة عالية وحماية مدمجة مع 2 متتبع MPPT.';
  }

  return {
    name: data.nameAr || data.name || (data as any).model || '',
    brand: data.brand || '',
    category,
    price: data.price !== undefined && data.price !== null ? data.price.toString() : '',
    phone: data.suppliers?.[0]?.phone || SUPPLIER_CONTACT_PHONE_DISPLAY,
    description: finalDescription,
    power,
    powerKw,
    efficiency,
    warranty,
    type: finalType,
    voltage: finalVoltage,
    current: finalCurrent,
    weight: finalWeight,
    mppt: finalMppt,
    capacity,
    crossSection: (specs.crossSection || '').toString(),
    length: (specs.cableLength || (category === 'cables' ? specs.length : '') || '').toString(),
    material: (specs.material || '').toString(),
    maxWind: (specs.maxWind || '').toString(),
    ipRating: (specs.ipRating || '').toString(),
    poles: (specs.poles || '').toString(),
    quantity: (specs.quantity || '').toString(),
    color: (specs.color || '').toString(),
    status: (data.status || 'available') as 'available' | 'limited' | 'out_of_stock',
    dimLength,
    dimWidth,
    dimThickness,
    dimensionUnit,
    area,
  };
};

export const ProductForm: React.FC<{ 
  lang: 'ar' | 'en'; 
  onSave: (product: Omit<Product, 'id'>) => void | Promise<void>; 
  onCancel: () => void;
  initialData?: Product | null;
}> = ({ lang, onSave, onCancel, initialData }) => {
  const t = translations[lang];
  const isAr = lang === 'ar';
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState(() => extractInitialFormData(initialData));

  // Sync state whenever initialData changes (e.g. user selects another product or switches views)
  useEffect(() => {
    setFormData(extractInitialFormData(initialData));
    setImagePreview(initialData?.image || null);
    setExistingAdditionalUrls(initialData?.additionalImages || []);
  }, [initialData]);

  const getFieldsForCategory = (cat: string) => {
    const common = ['price', 'warranty'];
    switch (cat) {
      case 'panels':
        return [...common, 'power', 'efficiency', 'type', 'voltage', 'current', 'weight'];
      case 'inverters':
        return [...common, 'powerKw', 'efficiency', 'type', 'mppt', 'voltage', 'current', 'weight'];
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

  // Real-time calculation of area based on length, width, and unit
  const lengthNum = parseFloat(formData.dimLength);
  const widthNum = parseFloat(formData.dimWidth);
  const hasDimensions = !isNaN(lengthNum) && !isNaN(widthNum) && lengthNum > 0 && widthNum > 0;

  let calculatedAreaInM2 = 0;
  let conversionText = '';

  if (hasDimensions) {
    let factor = 1;
    if (formData.dimensionUnit === 'mm') factor = 0.001;
    else if (formData.dimensionUnit === 'cm') factor = 0.01;

    const lengthInM = lengthNum * factor;
    const widthInM = widthNum * factor;
    const rawArea = lengthInM * widthInM;
    calculatedAreaInM2 = Math.round(rawArea * 1000) / 1000;

    // e.g., 2384 mm × 1303 mm => 2.384 × 1.303 = 3.106 m²
    if (formData.dimensionUnit === 'mm' || formData.dimensionUnit === 'cm') {
      conversionText = `${lengthInM} × ${widthInM} = ${calculatedAreaInM2} m²`;
    } else {
      conversionText = `${lengthNum} × ${widthNum} = ${calculatedAreaInM2} m²`;
    }
  }

  // Fallback to preserved area for existing products if dimensions are not specified
  const currentSavedAreaNum = parseFloat(formData.area) || 0;
  const effectiveArea = hasDimensions ? calculatedAreaInM2 : currentSavedAreaNum;

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

      const lengthVal = formData.dimLength && !isNaN(parseFloat(formData.dimLength)) ? parseFloat(formData.dimLength) : undefined;
      const widthVal = formData.dimWidth && !isNaN(parseFloat(formData.dimWidth)) ? parseFloat(formData.dimWidth) : undefined;
      const thicknessVal = formData.dimThickness && !isNaN(parseFloat(formData.dimThickness)) ? parseFloat(formData.dimThickness) : undefined;
      const dimensionUnitVal = formData.dimensionUnit;

      const finalArea = calculatedAreaInM2 > 0 
        ? calculatedAreaInM2 
        : (formData.area ? parseFloat(formData.area) || 0 : (initialData?.area ?? 0));

      let effectivePower = 0;
      if (formData.category === 'inverters') {
        effectivePower = formData.powerKw 
          ? Math.round(parseFloat(formData.powerKw) * 1000) 
          : (parseInt(formData.power) || initialData?.power || 0);
      } else {
        effectivePower = parseInt(formData.power) || (formData.powerKw ? Math.round(parseFloat(formData.powerKw) * 1000) : initialData?.power || 0);
      }

      const newProduct: any = {
        ...(initialData || {}),
        name: formData.name,
        nameAr: formData.name,
        brand: formData.brand,
        category: formData.category as any,
        price: parseInt(formData.price) || (initialData?.price ?? 0),
        power: effectivePower,
        efficiency: parseFloat(formData.efficiency) || (initialData?.efficiency ?? 0),
        warranty: parseInt(formData.warranty) || (initialData?.warranty ?? 0),
        image: imageUrl || initialData?.image || 'https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=2944&auto=format&fit=crop',
        image_url: imageUrl || initialData?.image || 'https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=2944&auto=format&fit=crop',
        additionalImages: finalAdditionalUrls,
        datasheetUrl: datasheetUrl || initialData?.datasheetUrl,
        length: lengthVal,
        width: widthVal,
        thickness: thicknessVal,
        dimensionUnit: dimensionUnitVal,
        area: finalArea,
        status: formData.status as any,
        updatedAt: new Date().toISOString().split('T')[0],
        supplierId: initialData?.supplierId || user?.uid || '',
        description: formData.description,
        notes: formData.description,
        specs: {
          ...(initialData?.specs || {}),
          description: formData.description,
          notes: formData.description,
          power: effectivePower,
          efficiency: parseFloat(formData.efficiency) || undefined,
          warranty: parseInt(formData.warranty) || undefined,
          type: formData.type,
          productType: formData.type,
          technology: formData.type,
          voltage: formData.voltage,
          vmpV: formData.category === 'panels' ? formData.voltage : undefined,
          nominalVoltage: formData.voltage,
          acVoltageV: formData.category === 'inverters' ? formData.voltage : undefined,
          current: formData.current,
          impA: formData.category === 'panels' ? formData.current : undefined,
          maxContinuousDischargeCurrentA: formData.current,
          pvMpptVoltageRangeV: formData.mppt || undefined,
          mppt: formData.mppt || undefined,
          weight: formData.weight,
          weightKg: formData.weight,
          capacity: formData.capacity,
          capacityAh: formData.capacity,
          powerKw: formData.powerKw || (effectivePower ? (effectivePower / 1000).toString() : undefined),
          ratedPowerKw: formData.powerKw ? parseFloat(formData.powerKw) : (effectivePower ? effectivePower / 1000 : undefined),
          crossSection: formData.crossSection,
          cableLength: formData.category === 'cables' ? formData.length : undefined,
          length: lengthVal !== undefined ? lengthVal : (formData.category === 'cables' ? formData.length : undefined),
          width: widthVal,
          thickness: thicknessVal,
          dimensionUnit: dimensionUnitVal,
          area: finalArea,
          material: formData.material,
          maxWind: formData.maxWind,
          ipRating: formData.ipRating,
          poles: formData.poles,
          quantity: formData.quantity,
          color: formData.color,
        },
        suppliers: (initialData?.suppliers && initialData.suppliers.length > 0)
          ? initialData.suppliers.map(s => ({
              ...s,
              price: parseInt(formData.price) || s.price || 0,
              lastUpdate: new Date().toISOString().split('T')[0]
            }))
          : [
              {
                id: initialData?.supplierId || user?.uid || '',
                name: (!isRawUidOrId(user?.company) && user?.company) ||
                      (!isRawUidOrId(user?.name) && user?.name) ||
                      'Enerjoo Certified Supplier',
                nameAr: (!isRawUidOrId(user?.companyAr) && user?.companyAr) ||
                        (!isRawUidOrId(user?.company) && user?.company) ||
                        (!isRawUidOrId(user?.nameAr) && user?.nameAr) ||
                        (!isRawUidOrId(user?.name) && user?.name) ||
                        'مورد معتمد',
                price: parseInt(formData.price) || 0,
                phone: SUPPLIER_CONTACT_PHONE_DISPLAY,
                location: user?.location || 'Cairo, Egypt',
                verified: user?.verified || false,
                lastUpdate: new Date().toISOString().split('T')[0]
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

        {fields.includes('mppt') && (
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1 flex items-center gap-1">
              <Zap size={13} className="text-solar-blue" />
              <span>{t.mppt || (isAr ? 'نطاق جهد الـ MPPT (فولت)' : 'MPPT Voltage Range (V)')}</span>
            </label>
            <input 
              type="text" 
              value={formData.mppt}
              onChange={e => setFormData(p => ({...p, mppt: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 min-h-[48px] text-base sm:text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder={t.mpptPlaceholder || (isAr ? "مثال: 160V - 950V أو 2 MPPT" : "e.g. 160V - 950V (2 MPPT)")}
            />
          </div>
        )}

        {fields.includes('voltage') && (
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1">
              {formData.category === 'inverters' 
                ? (isAr ? 'جهد الخرج المتردد (AC)' : 'AC Output Voltage')
                : formData.category === 'panels'
                ? (isAr ? 'جهد التشغيل الأقصى (Vmp)' : 'Max Power Voltage (Vmp)')
                : t.voltage}
            </label>
            <input 
              type="text" 
              value={formData.voltage}
              onChange={e => setFormData(p => ({...p, voltage: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 min-h-[48px] text-base sm:text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder={
                formData.category === 'inverters'
                  ? (isAr ? "مثال: 380/400V أو 220V" : "e.g. 380/400V or 220V")
                  : formData.category === 'panels'
                  ? (isAr ? "مثال: 41.5V" : "e.g. 41.5V")
                  : (isAr ? "مثال: 48V أو 220V أو 41.5V" : "e.g. 48V / 220V / 41.5V")
              }
            />
          </div>
        )}

        {fields.includes('current') && (
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1">
              {formData.category === 'inverters' 
                ? (isAr ? 'أقصى تيار خرج (AC)' : 'Max Output Current (AC)')
                : formData.category === 'panels'
                ? (isAr ? 'تيار التشغيل الأقصى (Imp)' : 'Max Power Current (Imp)')
                : t.current}
            </label>
            <input 
              type="text" 
              value={formData.current}
              onChange={e => setFormData(p => ({...p, current: e.target.value}))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-3 min-h-[48px] text-base sm:text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder={
                formData.category === 'inverters'
                  ? (isAr ? "مثال: 8.5A أو 16A" : "e.g. 8.5A or 16A")
                  : formData.category === 'panels'
                  ? (isAr ? "مثال: 14.94A" : "e.g. 14.94A")
                  : (isAr ? "مثال: 10.85A أو 13A أو 32A" : "e.g. 10.85A / 13A / 32A")
              }
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
        {/* Note: standalone manual area is removed in favor of the dedicated dimensions & auto-calculated area section below */}
      </div>

      {/* Product Dimensions & Auto-Calculated Area Section */}
      <div className="bg-solar-card border border-solar-border rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4 shadow-2xs text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-solar-border/60 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-solar-blue/10 text-solar-blue flex items-center justify-center shrink-0">
              <Ruler size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-solar-text flex items-center gap-2">
                <span>{isAr ? 'أبعاد ومساحة المنتج' : 'Product Dimensions & Area'}</span>
                <span className="text-[10px] font-bold text-solar-muted bg-solar-bg px-2 py-0.5 rounded-md border border-solar-border">
                  {isAr ? 'اختياري' : 'Optional'}
                </span>
              </h3>
              <p className="text-[11px] text-solar-muted font-bold">
                {isAr 
                  ? 'أدخل الطول والعرض ليتم حساب مساحة المنتج بالمتر المربع (m²) تلقائياً' 
                  : 'Enter length and width to auto-calculate area in square meters (m²)'}
              </p>
            </div>
          </div>

          {/* Unit Selector: mm / cm / m */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[11px] font-black text-solar-muted uppercase">{isAr ? 'وحدة القياس:' : 'Unit:'}</span>
            <div className="flex bg-solar-bg border border-solar-border rounded-xl p-1 shadow-2xs">
              {(['mm', 'cm', 'm'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, dimensionUnit: unit }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                    formData.dimensionUnit === unit 
                      ? 'bg-solar-blue text-white shadow-xs' 
                      : 'text-solar-muted hover:text-solar-text'
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3 Dimensions inputs: Length, Width, Thickness (optional) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Length */}
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1 flex items-center justify-between">
              <span>{isAr ? 'الطول (Length)' : 'Length'}</span>
              <span className="text-solar-blue font-black text-[10px]">{formData.dimensionUnit}</span>
            </label>
            <input 
              type="number" 
              inputMode="decimal"
              step="any"
              min="0"
              value={formData.dimLength}
              onChange={e => setFormData(p => ({ ...p, dimLength: e.target.value }))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder={formData.dimensionUnit === 'mm' ? '2384' : formData.dimensionUnit === 'cm' ? '238.4' : '2.384'}
            />
          </div>

          {/* Width */}
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1 flex items-center justify-between">
              <span>{isAr ? 'العرض (Width)' : 'Width'}</span>
              <span className="text-solar-blue font-black text-[10px]">{formData.dimensionUnit}</span>
            </label>
            <input 
              type="number" 
              inputMode="decimal"
              step="any"
              min="0"
              value={formData.dimWidth}
              onChange={e => setFormData(p => ({ ...p, dimWidth: e.target.value }))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder={formData.dimensionUnit === 'mm' ? '1303' : formData.dimensionUnit === 'cm' ? '130.3' : '1.303'}
            />
          </div>

          {/* Thickness (Optional) */}
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] font-black text-solar-muted uppercase ml-1 flex items-center justify-between">
              <span>{isAr ? 'السمك (Thickness)' : 'Thickness'}</span>
              <span className="text-solar-muted font-bold text-[10px]">({isAr ? 'اختياري' : 'Optional'})</span>
            </label>
            <input 
              type="number" 
              inputMode="decimal"
              step="any"
              min="0"
              value={formData.dimThickness}
              onChange={e => setFormData(p => ({ ...p, dimThickness: e.target.value }))}
              className="w-full bg-solar-bg border border-solar-border rounded-xl px-4 py-2.5 min-h-[44px] text-sm outline-none focus:border-solar-blue transition font-bold text-solar-text" 
              placeholder={formData.dimensionUnit === 'mm' ? '35' : formData.dimensionUnit === 'cm' ? '3.5' : '0.035'}
            />
          </div>
        </div>

        {/* Read-Only Auto-Calculated Area */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-solar-bg border border-solar-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-solar-muted uppercase">
                {isAr ? 'المساحة المحسوبة (Read-only):' : 'Calculated Area (Read-only):'}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-solar-card border border-solar-border text-solar-muted">
                m²
              </span>
            </div>
            
            <div className="text-base sm:text-lg font-black text-solar-blue flex items-center gap-2">
              <Calculator size={18} className="text-solar-blue shrink-0" />
              <span>
                {hasDimensions ? (
                  <>
                    {isAr ? 'المساحة المحسوبة:' : 'Calculated Area:'} <span className="underline decoration-solar-blue/40 underline-offset-4">{calculatedAreaInM2} m²</span>
                  </>
                ) : effectiveArea > 0 ? (
                  <>
                    {isAr ? 'المساحة المسجلة:' : 'Current Saved Area:'} <span>{effectiveArea} m²</span>
                  </>
                ) : (
                  <span className="text-solar-muted text-xs font-bold">
                    {isAr ? 'أدخل الطول والعرض بالأعلى لحساب المساحة تلقائياً' : 'Enter length and width above to calculate area'}
                  </span>
                )}
              </span>
            </div>

            {hasDimensions && conversionText && (
              <p className="text-[11px] font-bold text-solar-muted pt-1">
                {isAr ? `التحويل بالمتر: ${conversionText}` : `Metric calculation: ${conversionText}`}
              </p>
            )}
            {!hasDimensions && currentSavedAreaNum > 0 && (
              <p className="text-[11px] font-bold text-solar-muted pt-1">
                {isAr ? `هذا المنتج مسجل بمساحة ${currentSavedAreaNum} م² (يمكنك إدخال الطول والعرض لتحديثها تلقائياً)` : `This product has a saved area of ${currentSavedAreaNum} m² (enter length & width to update)`}
              </p>
            )}
          </div>

          <div className="shrink-0 self-start sm:self-center">
            {/* Read-only input display */}
            <input 
              type="text" 
              readOnly 
              value={effectiveArea > 0 ? `${effectiveArea} m²` : ''} 
              placeholder="0.000 m²"
              className="bg-solar-card border border-solar-border/80 text-solar-blue font-black text-sm px-3 py-2 rounded-xl text-center w-28 cursor-not-allowed select-all"
              tabIndex={-1}
              aria-label={isAr ? 'المساحة المحسوبة' : 'Calculated Area'}
            />
          </div>
        </div>
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
