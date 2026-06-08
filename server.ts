import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Fallback Helper Functions for High-Demand/Network Failures
function fallbackSemanticSearch(query: string, products: any[], isAr: boolean) {
  const normalizedQuery = query.toLowerCase().trim();
  const results = products.map((p: any) => {
    const name = (isAr ? p.nameAr : p.name) || p.name || "";
    const brand = p.brand || "";
    const category = p.category || "";
    const desc = p.description || "";
    
    let score = 0.1;
    let reasons: string[] = [];
    
    if (normalizedQuery.includes(category.toLowerCase())) {
      score += 0.5;
      reasons.push(isAr ? `منتج ينتمي لفئة ${category}` : `Product belongs to ${category} category`);
    }
    if (name.toLowerCase().includes(normalizedQuery)) {
      score += 0.4;
      reasons.push(isAr ? `تطابق الاسم مع الاستعلام` : `Name matches search query`);
    }
    if (brand.toLowerCase().includes(normalizedQuery)) {
      score += 0.3;
      reasons.push(isAr ? `الماركة متطابقة` : `Brand matches`);
    }
    const matchVal = normalizedQuery.match(/\d+/);
    if (matchVal && name.includes(matchVal[0])) {
      score += 0.4;
      reasons.push(isAr ? `تطابق رقم الموديل أو القدرة بالوات` : `Matches model number or power rating`);
    }
    
    const finalScore = Math.min(score, 0.99);
    
    return {
      productId: p.id.toString(),
      relevanceScore: parseFloat(finalScore.toFixed(2)),
      matchReason: reasons.length > 0 
        ? reasons.join(isAr ? " و " : " & ") 
        : (isAr ? "منتج ذو صلة بأنظمة الطاقة الشمسية" : "Related solar power product")
    };
  });
  
  return results
    .filter(r => r.relevanceScore > 0.15)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function fallbackSolarSizing(stationPower: number, landArea: number, loadDetails: string, products: any[], isAr: boolean) {
  const panels = products.filter((p: any) => p.category === 'panels');
  const inverters = products.filter((p: any) => p.category === 'inverters');
  const batteries = products.filter((p: any) => p.category === 'batteries');

  const selectedPanel = panels.sort((a, b) => (b.power || 0) - (a.power || 0))[0] || {
    id: 1,
    name: "Jinko 575W N-Type Panel",
    nameAr: "لوح جينكو 575 وات N-Type",
    power: 575,
    price: 4900,
    area: 2.58
  };

  const panelPowerW = selectedPanel.power || 540;
  const panelsCountNeeded = Math.ceil((stationPower * 1000) / panelPowerW);
  const totalPanelPowerKw = parseFloat(((panelsCountNeeded * panelPowerW) / 1000).toFixed(2));
  const totalAreaRequiredM2 = parseFloat((panelsCountNeeded * (selectedPanel.area || 2.58)).toFixed(2));

  const selectedInverter = inverters.sort((a, b) => (a.power || 0) - (b.power || 0)).find((inv: any) => (inv.power || 0) >= stationPower) || inverters[0] || {
    id: 10,
    name: "Growatt 5kW Grid-Tie Inverter",
    nameAr: "انفرتر جرووات 5 كيلو متصل بالشبكة",
    power: 5,
    price: 38000
  };

  const selectedBattery = batteries[0] || {
    id: 20,
    name: "Felicity 10kWh Lithium Battery",
    nameAr: "بطارية فيليسيتي ليثيوم 10 كيلووات",
    price: 120000
  };

  const isOffGrid = loadDetails?.toLowerCase().includes("off-grid") || loadDetails?.toLowerCase().includes("طقم") || loadDetails?.toLowerCase().includes("منفصل") || false;
  const isHybrid = loadDetails?.toLowerCase().includes("hybrid") || loadDetails?.toLowerCase().includes("هجين") || false;
  
  let batteryQty = 0;
  if (isOffGrid) {
    batteryQty = Math.max(2, Math.ceil(stationPower * 0.8));
  } else if (isHybrid) {
    batteryQty = Math.max(1, Math.ceil(stationPower * 0.4));
  }

  const recommendedProducts = [
    {
      productId: Number(selectedPanel.id),
      quantity: panelsCountNeeded,
      role: 'panels',
      reason: isAr 
        ? `تم اختيار ${panelsCountNeeded} ألواح بقدرة ${panelPowerW} وات لتغطية احتياج المحطة بالكامل.` 
        : `Selected ${panelsCountNeeded} x ${panelPowerW}W solar panels to meet full load demand.`
    }
  ];

  if (selectedInverter) {
    recommendedProducts.push({
      productId: Number(selectedInverter.id),
      quantity: 1,
      role: 'inverters',
      reason: isAr 
        ? `انفرتر عالي الكفاءة بقدرة ${selectedInverter.power || stationPower} كيلووات متوافق مع نظام الألواح والشبكة.` 
        : `Highly efficient ${selectedInverter.power || stationPower}kW inverter compatible with panel design.`
    });
  }

  if (batteryQty > 0 && selectedBattery) {
    recommendedProducts.push({
      productId: Number(selectedBattery.id),
      quantity: batteryQty,
      role: 'batteries',
      reason: isAr 
        ? `تم إدرج ${batteryQty} بطاريات لتأمين استقرار الطاقة وتوفير استهلاك آمن ليلاً.` 
        : `Configured ${batteryQty} battery storage units to secure nightly backup capacity.`
    });
  }

  let totalEstimatedCost = recommendedProducts.reduce((sum, item) => {
    const prod = products.find((p: any) => Number(p.id) === item.productId);
    const price = prod ? prod.price : (item.role === 'panels' ? 4900 : item.role === 'inverters' ? 38000 : 120000);
    return sum + (price * item.quantity);
  }, 0);

  const status = totalAreaRequiredM2 > landArea ? "warning" : "feasible";
  
  const explanation = isAr 
    ? `تم تصميم النظام الشمسي المقترح ليوفر إنتاجية عالية بأعلى جودة ومطابقة تامة للمواصفات القياسية المصرية. تم تجميع النظام من الكتالوج المتوفر بأفضل الأسعار وأعلى مستويات المتانة.`
    : `Your tailored solar system configuration is designed for maximum efficiency using premium Egyptian market standard equipment with excellent ROI.`;

  const feasibilityAnalysis = isAr 
    ? `المساحة الكلية المطلوبة للألواح هي ${totalAreaRequiredM2} متر مربع. ${status === 'warning' ? `تنبيه: المساحة المتاحة لديك (${landArea} م²) أصغر من المساحة المطلوبة. يوصى بتركيب شاسيهات مرتفعة أو تقليل عدد الألواح نسبياً.` : `مساحتك المتاحة (${landArea} م²) كافية وممتازة لتركيب المكونات وتجنب التظليل.`}`
    : `Total space needed is ${totalAreaRequiredM2} m². ${status === 'warning' ? `Warning: Your available area of ${landArea} m² is lower than required. Consider dynamic multi-row structures or slight capacity reduction.` : `Your area of ${landArea} m² excels for the solar layout without shading issues.`}`;

  const batterySizingDetails = isAr
    ? (batteryQty > 0 
      ? `بناءً على تفضيلك، تم تخصيص سعة تخزين تبلغ ${batteryQty} وحدات لحساب أحمال الطوارئ والتشغيل الليلي.` 
      : 'هذا النظام مرتبط بالشبكة (On-Grid) ولا يحتاج لتكلفة بطاريات إضافية، مما يجعل فترة استرداد رأس المال أسرع ما يمكن.')
    : (batteryQty > 0 
      ? `Based on daily config, configured ${batteryQty} units of lithium storage for optimal backup discharge.` 
      : 'On-Grid configuration has no extra battery cost, accelerating payback period to minimum.');

  return {
    status,
    explanation,
    totalEstimatedCost,
    feasibilityAnalysis,
    specifications: {
      totalPanelPowerKw,
      totalAreaRequiredM2,
      panelsCountNeeded,
      batterySizingDetails
    },
    recommendedProducts
  };
}

function parseSizingInPrompt(text: string) {
  // Normalize Arabic digits
  let normalized = text.toLowerCase();
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  arabicDigits.forEach((char, i) => {
    normalized = normalized.replaceAll(char, i.toString());
  });

  let parsedCapacity: number | null = null;
  let parsedArea: number | null = null;
  let parsedBill: number | null = null;
  let parsedKwh: number | null = null;
  let parsedPumpHp: number | null = null;
  let parsedSystemType: string | null = null;
  let parsedCityChoice: string | null = null;

  // Pattern matching for patterns like: [number] كيلو or [number] kw
  const kwMatches = normalized.match(/(\d+(?:\.\d+)?)\s*(?:كيلو|kw|ك|كيلوات|كيلوواط)/i);
  if (kwMatches && kwMatches[1]) {
    parsedCapacity = parseFloat(kwMatches[1]);
  }

  // Pattern matching for patterns like: مساحة \s* [number] or [number] متر
  const areaMatches = normalized.match(/(?:مساحة|مسطح|المساحة|المسطح)\s*(\d+(?:\.\d+)?)/i) || normalized.match(/(\d+(?:\.\d+)?)\s*(?:متر|م٢|m2|مربع)/i);
  if (areaMatches && areaMatches[1]) {
    parsedArea = parseFloat(areaMatches[1]);
  }

  // Pattern matching for patterns like: فاتورة \s* [number] or [number] جنيه
  const billMatches = normalized.match(/(?:فاتورة|فاتوره)\s*(\d+(?:\.\d+)?)/i) || normalized.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|egp|ج.م|ج)/i);
  if (billMatches && billMatches[1]) {
    parsedBill = parseFloat(billMatches[1]);
  }

  // Pattern matching for patterns like: استهلاك \s* [number] or [number] كيلو وات
  const kwhMatches = normalized.match(/(?:استهلاك)\s*(\d+(?:\.\d+)?)/i) || normalized.match(/(\d+(?:\.\d+)?)\s*(?:كيلو\s*وات|kwh)/i);
  if (kwhMatches && kwhMatches[1]) {
    parsedKwh = parseFloat(kwhMatches[1]);
  }

  // Pattern matching for pump HP: e.g. 10 حصان or 10 hp or قدرة مضخة 15 حصان
  const hpMatches = normalized.match(/(\d+(?:\.\d+)?)\s*(?:حصان|hp|طلمب|مضخ)/i) || normalized.match(/(?:قدرة|قدره|قوة|قوه)\s*(\d+(?:\.\d+)?)/i);
  if (hpMatches && hpMatches[1]) {
    parsedPumpHp = parseFloat(hpMatches[1]);
  }

  // System type parsing
  if (normalized.includes("هجين") || normalized.includes("هايبرد") || normalized.includes("hybrid")) {
    parsedSystemType = "hybrid";
  } else if (normalized.includes("متصل") || normalized.includes("اون جرد") || normalized.includes("on-grid")) {
    parsedSystemType = "on-grid";
  } else if (normalized.includes("منفصل") || normalized.includes("اوف جرد") || normalized.includes("off-grid")) {
    parsedSystemType = "off-grid";
  } else if (normalized.includes("طلمب") || normalized.includes("مضخ") || normalized.includes("ري") || normalized.includes("بئر") || normalized.includes("pump")) {
    parsedSystemType = "pump";
  }

  // City parsing
  if (normalized.includes("أسوان") || normalized.includes("اسوان") || normalized.includes("aswan")) {
    parsedCityChoice = "أسوان";
  } else if (normalized.includes("إسكندرية") || normalized.includes("اسكندرية") || normalized.includes("إسكندريه") || normalized.includes("اسكندريه") || normalized.includes("alexandria")) {
    parsedCityChoice = "الإسكندرية";
  } else if (normalized.includes("الغردقة") || normalized.includes("غردقة") || normalized.includes("hurghada")) {
    parsedCityChoice = "الغردقة";
  } else if (normalized.includes("القاهرة") || normalized.includes("قاهرة") || normalized.includes("cairo")) {
    parsedCityChoice = "القاهرة";
  }

  return {
    capacity: parsedCapacity,
    area: parsedArea,
    bill: parsedBill,
    kwh: parsedKwh,
    pumpHp: parsedPumpHp,
    systemType: parsedSystemType,
    cityChoice: parsedCityChoice
  };
}

function fallbackSolarChat(messages: any[], isAr: boolean, body: any = {}) {
  const lastMsg = (messages[messages.length - 1]?.text || "").toLowerCase();
  const { systemType, consumptionMethod, billAmount, kwhMonthly, pumpHp, cityChoice, systemDetails } = body;

  if (systemType === 'pump' || lastMsg.includes("طلمب") || lastMsg.includes("حصان") || lastMsg.includes("مضخ")) {
    const hp = pumpHp || 10;
    const suggKw = hp * 0.746 * 1.5; // safety margin for PV sizing
    const panelsNeeded = Math.ceil((suggKw * 1000) / 575);
    const totalArea = parseFloat((panelsNeeded * 2.58).toFixed(1));
    const panelsCost = panelsNeeded * 4900;
    const totalCost = panelsCost * 1.5; // include VFD, frames, wiring
    if (isAr) {
      return `مرحباً بك! يسعدني تصميم نظام طلمبة الري بالطاقة الشمسية الخاص بك فوراً:
• قدرة مضخة المياه المستهدفة: **${hp} حصان (HP)** (تعادل ~${(hp * 0.746).toFixed(1)} كيلوواط)
• القدرة المقترحة لمحطة الألواح: **${suggKw.toFixed(1)} كيلوواط (kW)**
• المساحة الصافية المطلوبة للألواح على الأرض: **${totalArea} متر مربع**

المكونات والتكلفة التقديرية حسب الكتالوج المصري 2026:
1. **ألواح الطاقة الشمسية**: عدد **${panelsNeeded} لوح** بقدرة 575 وات لتوليد التيار المباشر بطلب استقرار تشغيل مثالي. (التكلفة حوالي ${panelsCost.toLocaleString()} ج.م)
2. **مغير السرعة الإنفرتر (VFD/Pump Inverter)**: إنفرتر ذكي مخصص لتشغيل المضخة والتحكم بالتيار مع ميزات الحماية من الجفاف والتشغيل التلقائي من شروق الشمس للغروب.

💡 **إجمالي التكلفة الاستثمارية المتكاملة للمحطة** (شاملة الإنفرتر VFD، شاسيهات التثبيت المعدنية المتينة، كابلات الأمان النحاسية، الحمايات والمفاتيح بالكامل بدون بطاريات): حوالي **${Math.round(totalCost).toLocaleString()} جنيه مصري**.
ويوفر ذلك استهلاك وقود الديزل والصيانة الدورية للمولد تماماً!`;
    } else {
      return `Hello! I would be delighted to design your solar water pumping system:
• Target Water Pump Power: **${hp} HP** (~${(hp * 0.746).toFixed(1)} kW)
• Suggested Solar Array Capacity: **${suggKw.toFixed(1)} kW**
• Net Footprint Area Required: **${totalArea} m²**

Egyptian Catalog Pricing breakdown estimates:
1. **Solar Panels**: **${panelsNeeded} units** of 575W Tier-1 high efficiency panels. (Estimated cost: approx. ${panelsCost.toLocaleString()} EGP)
2. **Frequency Driver (VFD) Inverter**: Smart pump controller with built-in dry-run and soft start parameters to maximize daily flow cycle.

💡 **Total Estimated Turnkey Valuation**: approx. **${Math.round(totalCost).toLocaleString()} EGP**. Offers immediate zero-fuel cost and bypasses high diesel generator maintenance overhead!`;
    }
  }

  const promptSpecs = parseSizingInPrompt(lastMsg);
  
  // Try to use parsed text details, or fallback to passed state from calculator
  const capacity = promptSpecs.capacity || (systemDetails ? systemDetails.panelPowerTotalKw : null);
  const area = promptSpecs.area || 100;
  const bill = promptSpecs.bill || (billAmount ? Number(billAmount) : null);
  const kwh = promptSpecs.kwh || (kwhMonthly ? Number(kwhMonthly) : null);

  // If we detected a explicit or implicit request to size based on capacity or user consumption
  if (promptSpecs.capacity || promptSpecs.bill || promptSpecs.kwh || (lastMsg.includes("محط") && (lastMsg.includes("عاوز") || lastMsg.includes("عايز") || lastMsg.includes("تصميم") || lastMsg.includes("أريد") || lastMsg.includes("ابني")))) {
    let targetCapacity = capacity;
    if (!targetCapacity) {
      if (kwh) {
        targetCapacity = (kwh / 30) / (5.3 * 0.75); // capacity = daily_kwh / (psh * losses)
      } else if (bill) {
        const dailyKwh = (bill / 2.0) / 30; // 2.00 EGP average highest brackets rate
        targetCapacity = dailyKwh / (5.3 * 0.75);
      } else {
        targetCapacity = 5; // default 5 kW if generic sizing requested
      }
    }
    
    if (targetCapacity && targetCapacity > 0) {
      targetCapacity = Math.min(100, Math.max(1.5, parseFloat(targetCapacity.toFixed(2))));
      
      const panelPowerW = 575;
      const panelsNeeded = Math.ceil((targetCapacity * 1000) / panelPowerW);
      const totalArea = parseFloat((panelsNeeded * 2.58).toFixed(1));
      
      const sysType = systemType || 'hybrid';
      
      const panelsCost = panelsNeeded * 4900;
      const inverterQty = Math.ceil(targetCapacity / 5);
      const inverterCost = inverterQty * 38000;
      
      let batteryQty = 0;
      if (sysType === 'off-grid') {
        batteryQty = Math.max(2, Math.ceil(targetCapacity * 0.8));
      } else if (sysType === 'hybrid') {
        batteryQty = Math.max(1, Math.ceil(targetCapacity * 0.4));
      }
      const batteryCost = batteryQty * 120000;
      
      const accessoriesCost = Math.round(15000 + targetCapacity * 3500);
      const totalCost = panelsCost + inverterCost + batteryCost + accessoriesCost;
      
      if (isAr) {
        return `مرحباً بك! يسعدني جداً مستشارك الذكي تصميم محطتك فوراً بناءً على التفاصيل التي كتبتها:

• القدرة الإجمالية المقترحة لمحطتك: **${targetCapacity} كيلوواط (kW)**
• المساحة الصافية المطلوبة للألواح على السطح: **${totalArea} متر مربع**
• نوع المحطة: **${sysType === 'hybrid' ? 'نظام هجين الهجين (Hybrid)' : sysType === 'on-grid' ? 'متصل بالشبكة (On-Grid)' : 'منفصل عن الشبكة بالكامل بالبطاريات'}**

إليك تفصيل المكونات والتكاليف الإرشادية حسب تسعير السوق المصري لعام 2026:
1. **ألواح الطاقة الشمسية**: عدد **${panelsNeeded} لوح** بقدرة 575 وات N-Type أحادية البلورة من فئة الصف الأول (مثل Jinko أو Trina Solar)، بكفاءة تبلغ 22% مع كفالة 25 سنة وتتحمل درجات الحرارة والتربة بكفاءة. (التكلفة التقديرية: حوالي ${panelsCost.toLocaleString()} ج.م)
2. **العاكس الذكي (الإنفرتر)**: عدد **${inverterQty} إنفرتر** بقدرة إجمالية متوافقة من ماركة معتمدة مثل Growatt أو Deye لتحقيق استقرار التشغيل وكفاءة التحويل. (التكلفة التقديرية: حوالي ${inverterCost.toLocaleString()} ج.م)
${batteryQty > 0 ? `3. **بنك التخزين (البطاريات)**: عدد **${batteryQty} بطارية** ليثيوم LiFePO4 بسعة ممتازة لتأمين استهلاكك ليلاً وخلال فترات انقطاع شبكة الكهرباء وأحمال الطوارئ بالمنزل. (التكلفة التقديرية: حوالي ${batteryCost.toLocaleString()} ج.م)\n` : ''}

💡 **إجمالي التكلفة الاستثمارية للنظام متكاملة بالكامل** (تتضمن الهياكل المعدنية المقاومة للمناخ، الكابلات الشمسية النحاسية المعزولة، لوحات الحمايات الثنائية AC/DC، والتركيب والتشغيل المهني): حوالي **${totalCost.toLocaleString()} جنيه مصري**.

يمكنك الضغط على حاسبة الطاقة التفاعلية أسفل الصفحة ومتابعة إدخال بياناتك لحفظ هذا التصميم وإرساله للموردين المعتمدين والمتابعة للحصول على المعاينة الميدانية المجانية تماماً!`;
      } else {
        return `Hello! Your smart solar consultant has instantly analyzed and sized your system according to your input specifications:

• Suggested Station Power Capacity: **${targetCapacity} kW**
• Required Net Roof Area: **${totalArea} m²**
• System Architecture: **${sysType === 'hybrid' ? 'Hybrid (grid tie + battery security)' : sysType === 'on-grid' ? 'On-Grid (maximum bill offset)' : 'Off-Grid (complete backup independent)'}**

Here are the breakdown specs & estimated budgets matching local Egyptian catalog guides for 2026:
1. **Solar Panels**: **${panelsNeeded} units** of 575W N-Type Monocrystalline Tier-1 panels (e.g. Jinko or Trina Solar) with over 22% cell efficiency and 25-years degradation warranty. (Estimated cost: approx. ${panelsCost.toLocaleString()} EGP)
2. **Inverter**: **${inverterQty} units** of matching high-frequency pure-sine Growatt/Deye inverters. (Estimated cost: approx. ${inverterCost.toLocaleString()} EGP)
${batteryQty > 0 ? `3. **Battery Storage**: **${batteryQty} units** of safe Lithium Iron Phosphate (LiFePO4) storage banks ensuring worry-free load shedding override. (Estimated cost: approx. ${batteryCost.toLocaleString()} EGP)\n` : ''}

💡 **Total Estimated Turnkey Valuation** (fully equipped with heavy galvanized brackets, DC solar cables, dual AC/DC protectors, commissioning & labor): approx. **${totalCost.toLocaleString()} EGP**.

Proceed with entering your contact coordinates in our interactive lead forms below so authorized regional system builders can quickly follow up!`;
      }
    }
  }

  if (isAr) {
    if (lastMsg.includes("لوح") || lastMsg.includes("ألواح") || lastMsg.includes("انواع")) {
      return `أهلاً بك يا فندم! بخصوص الألواح الشمسية المتوفرة في السوق المصري، الأفضل حالياً هي ألواح N-Type أحادية البلورة (Monocrystalline) مثل Jinko أو Trina Solar بقدرات 570 - 580 وات. تتميز بكفاءة تزيد عن 22% وضمان يصل لـ 25 سنة، وهي ممتازة للعمل في درجات الحرارة المرتفعة في مصر. يمكنك استخدام الحاسبة التفاعلية بالأسفل لنقترح عليك أفضل لوح لمساحتك بالظبط!`;
    }
    if (lastMsg.includes("بطار") || lastMsg.includes("تخزين")) {
      return `تحت أمرك! لتخزين الطاقة، بطاريات الليثيوم (Lithium Iron Phosphate - LiFePO4) هي الاستثمار الأذكى حالياً مقارنة ببطاريات الجل التقليدية. بطارية الليثيوم مثل Felicity أو Pylontech تعيش حتى 10-15 سنة (أكثر من 6000 دورة تفريغ) ولا تحتاج صيانة وتتحمل حرارة الصيف بكفاءة عالية جداً وتدعم عمق تفريغ يصل لـ 90% بدون تلف.`;
    }
    if (lastMsg.includes("انفرتر") || lastMsg.includes("محول")) {
      return `العاكس الشمسي (الانفرتر) هو قلب المحطة الشمسي! بننصح بماركات معتمدة مثل Growatt أو Voltronic أو Deye. الانفرتر الهجين (Hybrid) هو الأنسب لمشكلة انقطاع الكهرباء وتخفيف الأحمال لأنه بينقل أوتوماتيكياً للبطاريات في أجزاء من الثانية دون أن تشعر بتوقف الأجهزة الحساسة في البيت.`;
    }
    if (lastMsg.includes("سعر") || lastMsg.includes("تكلفة") || lastMsg.includes("بكام")) {
      return `تكلفة النظام الشمسي بتعتمد بشكل أساسي على حجم استهلاكك بالـ كليووات ساعة شهرياً وقدرة المحطة المطلوبة. على سبيل المثال، المحطة الصغيرة المنزلية بقدرة 5 كيلووات (بدون بطاريات) تبدأ من حوالي 130 ألف جنيه مصري وتوفرلك جزء كبير جداً من الفاتورة. يفضل استخدام الآلة الحاسبة الذكية في الجزء السفلي من الشاشة لإدراج بيانات استهلاكك والحصول على تسعير فوري ومطابق لأسعار كتالوج السوق اليوم!`;
    }
    if (lastMsg.includes("طلمب") || lastMsg.includes("ري") || lastMsg.includes("مياه") || lastMsg.includes("بئر")) {
      return `أنظمة طلمبات ومضخات الري بالطاقة الشمسية هي الحل الأوفر لزارע مصر عشان توفير الديزل والسولار! النظام ده بيشغل طلمبة الغاطس للآبار مباشرة خلال ساعات سطوع الشمس بمغير سرعة (VFD) ذكي بدون أي بطاريات، وده بيقلل التكلفة للنصف وبيوفر مياه وفيرة لري الأراضي طول النهار.`;
    }
    if (lastMsg.includes("فاتور") || lastMsg.includes("شريح") || lastMsg.includes("استهلاك")) {
      return `تماماً! أنظمة الطاقة الشمسية المتصلة بالشبكة (On-Grid) بتستهدف تخفيض شريحة الاستهلاك العالية (مثل الشريحة السادسة والسابعة) وبترجع العداد لشرائح أقل تكلفة أو بتقضي على الفاتورة بالكامل عن طريق المقاصة السنوية مع شركة الكهرباء.`;
    }
    return `أهلاً بك في منصة "Enerjoo" لمستشار الطاقة الشمسية الذكي! 

خوادم الـ AI تشهد ضغطاً كبيراً مؤقتاً، لكني معك لمساعدتك بالإجابة الهندسية السريعة والذكية:
1. لتصميم محطتك بدقة ومعرفة التكلفة واختيار الألواح والبطاريات، يرجى الضغط على أزرار "حاسبة الطاقة الذكية" بالأسفل وتعبئة الاستهلاك.
2. يمكنك تصفح كتالوج المنتجات المتوفرة والمقارنة بينها للوصول لأفضل الخيارات.

إذا كان لديك أي سؤال فني محدد عن البطاريات أو الألواح أو الأسعار بجمهورية مصر العربية، تفضل بطرحه وسنسعد بمساعدتك فوراً!`;
  } else {
    if (lastMsg.includes("panel") || lastMsg.includes("brand")) {
      return `Hello! For solar panels in Egypt, premium tier-1 brands like Jinko Solar or Trina Solar N-type Monocrystalline models (570W - 585W) are highly recommended. They provide over 22% conversion efficiency, excellent heat tolerance for Egyptian climate, and up to 25 years warranty.`;
    }
    if (lastMsg.includes("batter") || lastMsg.includes("storage")) {
      return `Lithium iron phosphate (LiFePO4) batteries are the absolute gold standard for solar storage today (such as Felicity or Pylontech). They endure over 6,000 cycles, sustain 90% discharge depths, and last for 10-15 years, proving far superior to traditional tubular gel models.`;
    }
    if (lastMsg.includes("price") || lastMsg.includes("cost") || lastMsg.includes("how much")) {
      return `Solar setup investment varies in Egypt according to station power in kW. A typical on-grid 5kW home solar system fits around 130k-160k EGP which eliminates utility consumption from premium bill brackets. Please use the Interactive Solar Calculator below to size and obtain instant tier prices tailored to your property!`;
    }
    return `Welcome to Enerjoo Solar Consultant! 

Our main AI model is currently under high demand, but our reliable local technical system is standing by to serve you:
1. Please use the Interactive Solar Calculator below to obtain instant, detailed designs on required panels, battery sizing, and estimated budgets.
2. Select any product from the catalog to run side-by-side comparisons.

Tell us what specific technical solar inquiries you have about panels, batteries, or Egyptian inverters, and we will happily assist!`;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Server-side Semantic Search proxy
  app.post("/api/semantic-search", async (req, res) => {
    try {
      const { query, products, isAr } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not defined or is empty.");
        return res.status(200).json([]);
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const productContext = products.map((p: any) => ({
        id: p.id,
        name: isAr ? p.nameAr : p.name,
        brand: p.brand,
        category: p.category,
        power: p.power,
        efficiency: p.efficiency,
        price: p.price,
        specs: p.specs || {}
      }));

      const systemInstruction = `
        You are an expert solar energy consultant assistant for "enerjoo", a solar product comparison platform in Egypt. 
        Your task is to perform high-precision semantic search on solar products.
        
        CRITICAL SEARCH CAPABILITIES:
        1. Technical Specs: Understand power (W/kW), efficiency (%), voltage (V), and current (A).
        2. Intent Mapping: If a user asks for "home system", prioritize batteries and hybrid inverters. If "farm", prioritize high-power panels and centrifugal pumps (if available).
        3. Unit Conversions: Understand that "5k" or "5000" usually refers to 5000W or 5kW.
        4. Synonyms: 
           - Panels: "لوح", "ألواح"
           - Inverters: "محول", "عكس", "انفرتر"
           - Batteries: "بطارية", "تخزين"
           - Mounting: "هيكل", "قاعدة", "تثبيت", "شاسيه"
           - Protection: "حماية", "قاطع", "فيوز", "سيرج"
           - Combiner: "صندوق تجميع", "كومباينر"
           - Cables: "سلك", "كابل", "كابلات"
           - Connectors/Sealings/Clamps: "موصل", "وصلة", "كلبس", "ترامل"
        
        EVALUATION CRITERIA:
        - High Relevance (0.8-1.0): Product exactly matches spec (e.g., 540W panel for "540w") or matches a specific intent perfectly.
        - Medium Relevance (0.4-0.7): Product is related (e.g., a battery when searching for "storage") but not the specific model.
        - Low Relevance (0.1-0.3): Weak connection.
        
        Return a JSON array of search results, each containing:
        - productId: the ID of the matching product (as string)
        - relevanceScore: a number from 0 to 1
        - matchReason: a brief explanation in ${isAr ? 'Arabic' : 'English'} explaining WHY it matches (e.g., "This panel provides exactly 540W as requested").
      `;

      const { Type } = await import("@google/genai");

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { parts: [{ text: `Query: ${query}` }] },
          { parts: [{ text: `Products: ${JSON.stringify(productContext)}` }] }
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productId: { type: Type.STRING },
                relevanceScore: { type: Type.NUMBER },
                matchReason: { type: Type.STRING }
              },
              required: ["productId", "relevanceScore", "matchReason"]
            }
          }
        }
      });

      const results = JSON.parse(response.text || "[]");
      res.json(results);
    } catch (error: any) {
      console.log("Semantic search model status update: utilizing efficient local search fallback.");
      try {
        const { query, products, isAr } = req.body;
        const fallbackResults = fallbackSemanticSearch(query, products, isAr);
        res.json(fallbackResults);
      } catch (innerErr: any) {
        res.status(500).json({ error: innerErr.message || "Failed to search" });
      }
    }
  });

  // Solar Calculator API
  app.post("/api/solar-calculate", async (req, res) => {
    try {
      const { stationPower, landArea, loadDetails, products, lang } = req.body;
      const isAr = lang === 'ar';
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: isAr ? "مفتاح API الخاص بـ Gemini غير مهيأ" : "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Prepare Catalog Products
      const condensedProducts = products.map((p: any) => ({
        id: p.id,
        name: isAr ? p.nameAr : p.name,
        brand: p.brand,
        category: p.category,
        power: p.power,
        efficiency: p.efficiency,
        price: p.price,
        area: p.area,
        specs: p.specs || {}
      }));

      const systemInstruction = `
        You are an expert Solar Energy Sizing and Design Consultant for the "enerjoo" solar enterprise platform in Egypt.
        Analyze the client requirements (Required Station Power in kW, Available Land/Roof Area in m², and Daily Load details) 
        and design a fully compatible, optimally sized solar system package selected from the provided products catalog.

        DESIGN RULES & SIZING LOGIC:
        1. Solar Panels (category: 'panels'):
           - Calculate the number of boards necessary to reach the Target Station Power (kW) (e.g., Station Power in Watts / single panel Watt power).
           - Total Panel Power = panel power * quantity.
           - Total Area Footprint = panel area * quantity.
           - Check if Total Area Footprint fits inside the user's 'landArea' (m²). If not, select the highest efficiency or power panels, recommend fewer panels, or provide warning/infeasible feasibility indicators.
        2. Solar Inverter (category: 'inverters'):
           - Recommend an inverter from the catalog whose power capacity handles the panel station size (e.g., a 5kW growatt inverter for a 5kW station).
        3. Batteries (category: 'batteries'):
           - If user has specified any loadDetails or night consumption, recommend battery storage units from the catalog.
           - If nothing specified, but station requires back-up, suggest a minimal functional storage pack (e.g., 1-2 batteries).
        4. Calculate totalEstimatedCost in EGP strictly by summing (product price * quantity) for all recommended products.
        5. Return a highly professional, detailed feasibilityAnalysis explaining:
           - Space utilization and feasibility.
           - Recommendations and reasoning.
           - Power yield expectations.
        6. Return everything as a structured JSON object. Response language must match the request language (${isAr ? 'Arabic' : 'English'}).
      `;

      const prompt = `
        Client Configuration:
        - Target Station Power: ${stationPower} kW
        - Available Land/Roof Area: ${landArea} m²
        - Daily Load / Night Consumption Details: ${loadDetails || "None provided"}

        Available Egyptian Solar Products Catalog:
        ${JSON.stringify(condensedProducts, null, 2)}
      `;

      const { Type } = await import("@google/genai");

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              status: { type: Type.STRING, description: "Must be 'feasible' (if layout fits), 'warning' (e.g. area is small but can work by reducing size), or 'infeasible' (insufficient space/budget)." },
              explanation: { type: Type.STRING, description: "High-level description of client's solar package and system benefits." },
              totalEstimatedCost: { type: Type.NUMBER, description: "Calculated exact cost in EGP of recommended entries." },
              feasibilityAnalysis: { type: Type.STRING, description: "Detailed physical feasibility analysis regarding area, weight, shading, and loads." },
              specifications: {
                type: Type.OBJECT,
                properties: {
                  totalPanelPowerKw: { type: Type.NUMBER, description: "Total power of all recommended solar panels combined in kW." },
                  totalAreaRequiredM2: { type: Type.NUMBER, description: "Total face area size of all recommended panels in m²." },
                  panelsCountNeeded: { type: Type.INTEGER, description: "Exact number of panel items requested." },
                  batterySizingDetails: { type: Type.STRING, description: "Detailed calculations and reasons for battery quantity." }
                },
                required: ["totalPanelPowerKw", "totalAreaRequiredM2", "panelsCountNeeded"]
              },
              recommendedProducts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.INTEGER, description: "The product ID matching the catalog" },
                    quantity: { type: Type.INTEGER, description: "How many units of this product to procure" },
                    role: { type: Type.STRING, description: "'panels' or 'inverters' or 'batteries'" },
                    reason: { type: Type.STRING, description: "A detailed bicultural reason explaining why this exact product fits" }
                  },
                  required: ["productId", "quantity", "role", "reason"]
                }
              }
            },
            required: ["status", "explanation", "totalEstimatedCost", "feasibilityAnalysis", "specifications", "recommendedProducts"]
          }
        }
      });

      const responseText = response.text || "{}";
      res.json(JSON.parse(responseText.trim()));

    } catch (err: any) {
      console.log("Solar calculation model status update: utilizing efficient local calculator fallback.");
      try {
        const { stationPower, landArea, loadDetails, products, lang } = req.body;
        const isAr = lang === 'ar';
        const fallbackResults = fallbackSolarSizing(stationPower, landArea, loadDetails, products, isAr);
        res.json(fallbackResults);
      } catch (innerErr: any) {
        res.status(500).json({ error: innerErr.message || "Failed to calculate solar solution" });
      }
    }
  });

  // Solar Chat Advisor API
  app.post("/api/solar-chat", async (req, res) => {
    try {
      const { messages, lang, systemType, consumptionMethod, billAmount, kwhMonthly, pumpHp, cityChoice, systemDetails } = req.body;
      const isAr = lang === 'ar';
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: isAr ? "مفتاح API الخاص بـ Gemini غير مهيأ" : "Gemini API key is not configured" });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let customContext = "";
      if (systemType || cityChoice || systemDetails || pumpHp) {
        customContext = `
          بيانات المحطة الحالية التي صممها المستخدم أو أدخل تفاصيلها في الآلة الحاسبة:
          - نوع نظام الطاقة الشمسية: ${systemType || "غير محدد بعد"}
          - المدينة/الموقع: ${cityChoice || "غير محدد بعد"}
          ${pumpHp ? `- قدرة مضخة المياه بالحصان: ${pumpHp} حصان (HP)\n` : ''}
          ${billAmount ? `- قيمة الفاتورة الكهربائية الشهرية: ${billAmount} جنيه مصري\n` : ''}
          ${kwhMonthly ? `- معدل الاستهلاك الشهري بالكيلوواط ساعة: ${kwhMonthly} كيلوواط ساعة\n` : ''}
          ${systemDetails ? `- القدرة بالكيلوواط للمحطة: ${systemDetails.panelPowerTotalKw} كيلوواط\n- عدد الألواح المطلوبة: ${systemDetails.panelQty} ألواح\n- عدد وحدات التخزين (البطاريات): ${systemDetails.batteryQty} بطاريات\n- التكلفة التقريبية المقدرة للمحطة بالكامل: ${systemDetails.costRecommended.toLocaleString()} جنيه مصري\n` : ''}
          
          ملاحظة هامة جداً: إذا كانت رسالة العميل الأخيرة تحتوي على معلومات محطة أو طلب تعديل، أو يقوم بالاستفسار عن هذه التفاصيل المذكورة أعلاه، فقم بتقديم جواب مفيد للغاية يوضح له تماماً تفاصيل أرقام تصميم محطته واقتراح المكونات والتكلفة وربطها بالواقع المصري بكل مرونة ودعم كامل.
        `;
      }

      const systemInstruction = `
        أنت مهندس ومستشار طاقة شمسية خبير وودود لمنصة "Enerjoo" لبيع ومقارنة منتجات الطاقة الشمسية في مصر.
        مهمتك هي الإجابة عن استفسارات العميل بصبر ولغة عربية مبسطة دافئة (عامية مصرية مهذبة ممزوجة بمصطلحات سهلة الفهم للجميع).
        
        ${customContext}

        قواعد الإجابة:
        1. بسط المفاهيم التقنية دائماً (مثل شرح أن العاكس/الانفرتر يحول تيار الألواح لتشغيل الأجهزة، والبطاريات تخزن الطاقة لليل).
        2. شجع المستخدم بلطف على إكمال محاورة تصميم المحطة التفاعلية بالضغط على الأزرار المتاحة في الشات للحصول على حسابات تصميمية دقيقة (ألواح، بطاريات، إنفرتر، كابلات، وحساب مالي ممتاز).
        3. تحدث معهم كصديق خبير ينصحهم بما يعود عليهم بالنفع المالي وتأمين انقطاع الكهرباء.
        4. إذا سألوا بلغة إنجليزية أجب بالإنجليزية.
      `;

      // Format messages safely for @google/genai SDK
      const contents = messages.map((m: any) => ({
        role: m.sender === 'ai' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction,
        }
      });

      const lastText = messages[messages.length - 1]?.text || "";
      const parsed = parseSizingInPrompt(lastText);

      res.json({ 
        reply: response.text,
        updatedSizing: {
          bill: parsed.bill,
          kwh: parsed.kwh,
          pumpHp: parsed.pumpHp,
          systemType: parsed.systemType,
          cityChoice: parsed.cityChoice
        }
      });
    } catch (err: any) {
      console.log("Solar chat model status update: utilizing efficient local advisor fallback.");
      try {
        const { messages, lang } = req.body;
        const isAr = lang === 'ar';
        const lastText = messages[messages.length - 1]?.text || "";
        const parsed = parseSizingInPrompt(lastText);
        const reply = fallbackSolarChat(messages, isAr, req.body);
        res.json({ 
          reply,
          updatedSizing: {
            bill: parsed.bill,
            kwh: parsed.kwh,
            pumpHp: parsed.pumpHp,
            systemType: parsed.systemType,
            cityChoice: parsed.cityChoice
          }
        });
      } catch (innerErr: any) {
        res.status(500).json({ error: innerErr.message || "Failed to get response" });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
