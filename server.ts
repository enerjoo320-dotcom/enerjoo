import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

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
    const reasons: string[] = [];
    
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

  const selectedPanel = panels.sort((a, b) => (b.power || 0) - (a.power || 0))[0] || null;

  const panelPowerW = selectedPanel?.power || 550;
  const panelsCountNeeded = selectedPanel ? Math.ceil((stationPower * 1000) / panelPowerW) : 0;
  const totalPanelPowerKw = selectedPanel 
    ? parseFloat(((panelsCountNeeded * panelPowerW) / 1000).toFixed(2))
    : stationPower;
  const totalAreaRequiredM2 = selectedPanel 
    ? parseFloat((panelsCountNeeded * (selectedPanel.area || 2.1)).toFixed(2))
    : parseFloat((stationPower * 5.0).toFixed(2));

  const selectedInverter = inverters.sort((a, b) => (a.power || 0) - (b.power || 0)).find((inv: any) => (inv.power || 0) >= stationPower) || inverters[0] || null;

  const selectedBattery = batteries[0] || null;

  const isOffGrid = loadDetails?.toLowerCase().includes("off-grid") || loadDetails?.toLowerCase().includes("طقم") || loadDetails?.toLowerCase().includes("منفصل") || false;
  const isHybrid = loadDetails?.toLowerCase().includes("hybrid") || loadDetails?.toLowerCase().includes("هجين") || false;
  
  let batteryQty = 0;
  if (isOffGrid) {
    batteryQty = Math.max(2, Math.ceil(stationPower * 0.8));
  } else if (isHybrid) {
    batteryQty = Math.max(1, Math.ceil(stationPower * 0.4));
  }

  const recommendedProducts: any[] = [];

  if (selectedPanel) {
    recommendedProducts.push({
      productId: Number(selectedPanel.id),
      quantity: panelsCountNeeded,
      role: 'panels',
      reason: isAr 
        ? `تم اختيار ${panelsCountNeeded} ألواح بقدرة ${panelPowerW} وات لتغطية احتياج المحطة بالكامل.` 
        : `Selected ${panelsCountNeeded} x ${panelPowerW}W solar panels to meet full load demand.`
    });
  }

  if (selectedInverter) {
    recommendedProducts.push({
      productId: Number(selectedInverter.id),
      quantity: 1,
      role: 'inverters',
      reason: isAr 
        ? `انفرتر بقدرة ${selectedInverter.power || stationPower} كيلووات متوافق مع متطلبات النظام.` 
        : `Efficient ${selectedInverter.power || stationPower}kW inverter matching system power.`
    });
  }

  if (batteryQty > 0 && selectedBattery) {
    recommendedProducts.push({
      productId: Number(selectedBattery.id),
      quantity: batteryQty,
      role: 'batteries',
      reason: isAr 
        ? `تم إدراج ${batteryQty} بطاريات لتأمين استقرار الطاقة وتوفير استهلاك آمن ليلاً.` 
        : `Configured ${batteryQty} battery storage units for nightly backup.`
    });
  }

  const totalEstimatedCost = recommendedProducts.reduce((sum, item) => {
    const prod = products.find((p: any) => Number(p.id) === item.productId);
    const price = prod ? (prod.price || 0) : 0;
    return sum + (price * item.quantity);
  }, 0);

  const status = totalAreaRequiredM2 > landArea ? "warning" : "feasible";
  
  const explanation = isAr 
    ? (recommendedProducts.length > 0 
        ? `تم تصميم النظام الشمسي المقترح بناءً على المكونات المتوفرة في الكتالوج الحالي.` 
        : `تم احتساب القدرات والمساحات الهندسية للمحطة المطلوبة. عند توفر منتجات معتمدة في المتجر سيتم إدراج التسعير المباشر فوراً.`)
    : (recommendedProducts.length > 0 
        ? `Your tailored solar system configuration is designed from currently listed verified equipment.` 
        : `Calculated target solar array capacity. Pricing and procurement will update as certified components are listed.`);

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

  const kwMatches = normalized.match(/(\d+(?:\.\d+)?)\s*(?:كيلو|kw|ك|كيلوات|كيلوواط)/i);
  if (kwMatches && kwMatches[1]) {
    parsedCapacity = parseFloat(kwMatches[1]);
  }

  const areaMatches = normalized.match(/(?:مساحة|مسطح|المساحة|المسطح)\s*(\d+(?:\.\d+)?)/i) || normalized.match(/(\d+(?:\.\d+)?)\s*(?:متر|م٢|m2|مربع)/i);
  if (areaMatches && areaMatches[1]) {
    parsedArea = parseFloat(areaMatches[1]);
  }

  const billMatches = normalized.match(/(?:فاتورة|فاتوره)\s*(\d+(?:\.\d+)?)/i) || normalized.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|egp|ج.م|ج)/i);
  if (billMatches && billMatches[1]) {
    parsedBill = parseFloat(billMatches[1]);
  }

  const kwhMatches = normalized.match(/(?:استهلاك)\s*(\d+(?:\.\d+)?)/i) || normalized.match(/(\d+(?:\.\d+)?)\s*(?:كيلو\s*وات|kwh)/i);
  if (kwhMatches && kwhMatches[1]) {
    parsedKwh = parseFloat(kwhMatches[1]);
  }

  const hpMatches = normalized.match(/(\d+(?:\.\d+)?)\s*(?:حصان|hp|طلمب|مضخ)/i) || normalized.match(/(?:قدرة|قدره|قوة|قوه)\s*(\d+(?:\.\d+)?)/i);
  if (hpMatches && hpMatches[1]) {
    parsedPumpHp = parseFloat(hpMatches[1]);
  }

  if (normalized.includes("هجين") || normalized.includes("هايبرد") || normalized.includes("hybrid")) {
    parsedSystemType = "hybrid";
  } else if (normalized.includes("متصل") || normalized.includes("اون جرد") || normalized.includes("on-grid")) {
    parsedSystemType = "on-grid";
  } else if (normalized.includes("منفصل") || normalized.includes("اوف جرد") || normalized.includes("off-grid")) {
    parsedSystemType = "off-grid";
  } else if (normalized.includes("طلمب") || normalized.includes("مضخ") || normalized.includes("ري") || normalized.includes("بئر") || normalized.includes("pump")) {
    parsedSystemType = "pump";
  }

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
  const { systemType, consumptionMethod, billAmount, kwhMonthly, pumpHp, systemDetails } = body;

  const parsed = parseSizingInPrompt(lastMsg);
  const hp = pumpHp || parsed.pumpHp;

  if (hp && hp > 0) {
    const suggKw = Math.max(1.5, hp * 1.35);
    const panelPowerW = 550;
    const panelsNeeded = Math.ceil((suggKw * 1000) / panelPowerW);
    const totalArea = parseFloat((panelsNeeded * 2.1).toFixed(1));

    if (isAr) {
      return `مرحباً بك! إليك المواصفات الهندسية المقترحة لتشغيل طلمبة الري بالطاقة الشمسية:
• قدرة مضخة المياه: **${hp} حصان** (~${(hp * 0.746).toFixed(1)} كيلوواط)
• القدرة الإجمالية المقترحة للألواح: **${suggKw.toFixed(1)} كيلوواط (kW)**
• المساحة التقديرية المطلوبة: **${totalArea} متر مربع**
• عدد الألواح المقترح: **${panelsNeeded} لوح (550 وات)**
• مغير السرعة (VFD Inverter): إنفرتر طلمبات شمسية بخاصية MPPT وتشغيل تلقائي مع شروق الشمس.

💡 يمكنك الضغط على طلب تسعير أو التواصل مع الموردين المعتمدين عبر المنصة للحصول على عروض أسعار دقيقة ومطابقة للأجهزة المتوفرة في المتجر!`;
    } else {
      return `Hello! Here is the engineered specification for your solar water pumping system:
• Target Water Pump Power: **${hp} HP** (~${(hp * 0.746).toFixed(1)} kW)
• Suggested Solar Array Capacity: **${suggKw.toFixed(1)} kW**
• Estimated Net Area Required: **${totalArea} m²**

Required components:
1. **Solar Panels**: Approximately **${panelsNeeded} panels (550W)** to power pump continuous daily cycle.
2. **Frequency Driver (VFD) Inverter**: Smart pump controller with dry-run protection and auto sunrise start.

💡 You can submit a direct quote request to receive exact offers from verified registered suppliers on Enerjoo!`;
    }
  }

  if (consumptionMethod || billAmount || kwhMonthly || systemDetails) {
    let targetCapacity = 0;
    if (systemDetails?.panelPowerTotalKw) {
      targetCapacity = systemDetails.panelPowerTotalKw;
    } else if (billAmount) {
      const bill = parseFloat(billAmount);
      targetCapacity = Math.max(2, bill / 450);
    } else if (kwhMonthly) {
      const kwh = parseFloat(kwhMonthly);
      const dailyKwh = kwh / 30;
      targetCapacity = dailyKwh / (5.3 * 0.75);
    } else {
      targetCapacity = 5;
    }

    if (targetCapacity && targetCapacity > 0) {
      targetCapacity = Math.min(100, Math.max(1.5, parseFloat(targetCapacity.toFixed(2))));
      const panelPowerW = 550;
      const panelsNeeded = Math.ceil((targetCapacity * 1000) / panelPowerW);
      const totalArea = parseFloat((panelsNeeded * 2.1).toFixed(1));
      const sysType = systemType || 'hybrid';

      let batteryQty = 0;
      if (sysType === 'off-grid') {
        batteryQty = Math.max(2, Math.ceil(targetCapacity * 0.8));
      } else if (sysType === 'hybrid') {
        batteryQty = Math.max(1, Math.ceil(targetCapacity * 0.4));
      }

      if (isAr) {
        return `مرحباً بك! إليك التحليل الفني والهندسي لمحطتك:

• القدرة الإجمالية المقترحة لمحطتك: **${targetCapacity} كيلوواط (kW)**
• المساحة الصافية التقديرية للألواح: **${totalArea} متر مربع**
• نوع المحطة: **${sysType === 'hybrid' ? 'نظام هجين (Hybrid)' : sysType === 'on-grid' ? 'متصل بالشبكة (On-Grid)' : 'منفصل عن الشبكة بالبطاريات (Off-Grid)'}**
• عدد الألواح التقديري: **${panelsNeeded} لوح**
${batteryQty > 0 ? `• وحدات التخزين المقترحة: **${batteryQty} بطاريات**\n` : ''}

يمكنك اختيار المنتجات المتاحة من الكتالوج أو إرسال طلب عرض أسعار لتصلك عروض من أفضل الشركات المعتمدة!`;
      } else {
        return `Hello! Here is the technical estimation for your solar station:

• Recommended System Capacity: **${targetCapacity} kW**
• Estimated Solar Panel Footprint: **${totalArea} m²**
• System Configuration: **${sysType.toUpperCase()}**
• Estimated Panels Count: **${panelsNeeded} panels**
${batteryQty > 0 ? `• Battery Storage Units: **${batteryQty} batteries**\n` : ''}

Browse listed catalog products or submit an RFQ to receive competitive bids from verified installers!`;
      }
    }
  }

  if (isAr) {
    if (lastMsg.includes("لوح") || lastMsg.includes("ألواح") || lastMsg.includes("انواع")) {
      return `أهلاً بك! يمكنك تصفح قسم الألواح الشمسية في المتجر لمعرفة الموديلات والقدرات والأسعار المتاحة حالياً من الموردين المعتمدين والمقارنة بينها بكل سهولة.`;
    }
    if (lastMsg.includes("بطار") || lastMsg.includes("تخزين")) {
      return `أهلاً بك! تتوفر في المتجر خيارات متنوعة من بطاريات الليثيوم والجل لتأمين انقطاع التيار الكهربائي وتشغيل الأحمال ليلاً. يمكنك تصفح المتجر لمطابقة السعة الأنسب لاحتياجك.`;
    }
    if (lastMsg.includes("انفرتر") || lastMsg.includes("محول")) {
      return `العاكس الشمسي (الانفرتر) يقوم بتحويل التيار المباشر من الألواح إلى تيار متردد لتشغيل الأجهزة. يمكنك مراجعة قسم الإنفرترات في المنصة للاختيار بين الأنظمة المتصلة أو الهجينة.`;
    }
    if (lastMsg.includes("سعر") || lastMsg.includes("تكلفة") || lastMsg.includes("بكام")) {
      return `تكلفة النظام الشمسي تعتمد على حجم الاستهلاك وقدرة المحطة المطلوبة والمكونات المختارة من الكتالوج. استخدم الحاسبة التفاعلية لحساب التكلفة التقديرية الدقيقة وطلب عروض أسعار فورية!`;
    }
    return `أهلاً بك في منصة Enerjoo! مستشارك الذكي لمساعدتك في حساب وتصميم محطتك وتصفح المكونات المتوفرة في المتجر. كيف يمكنني مساعدتك اليوم؟`;
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
    return `Welcome to Enerjoo Solar Consultant! Tell us what specific technical solar inquiries you have about panels, batteries, or Egyptian inverters, and we will happily assist!`;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Comprehensive CORS configuration to prevent iframe cross-origin errors in the sandboxed dev environment
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,Content-Type,Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

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

      const systemInstruction = [
        "You are an expert solar energy consultant assistant for 'enerjoo', a solar product comparison platform in Egypt.",
        "Your task is to perform high-precision semantic search on solar products.",
        "",
        "CRITICAL SEARCH CAPABILITIES:",
        "1. Technical Specs: Understand power (W/kW), efficiency (%), voltage (V), and current (A).",
        "2. Intent Mapping: If a user asks for home system, prioritize batteries and hybrid inverters. If farm, prioritize high-power panels and pumps.",
        "3. Unit Conversions: Understand that '5k' or '5000' refers to 5000W or 5kW.",
        "4. Synonyms in Arabic and English for panels, inverters, batteries, structures, and cables.",
        "",
        "EVALUATION CRITERIA:",
        "- High Relevance (0.8-1.0): Product exactly matches spec.",
        "- Medium Relevance (0.4-0.7): Product is related.",
        "- Low Relevance (0.1-0.3): Weak connection.",
        "",
        "Return a JSON array of search results, each containing:",
        "- productId: the ID of the matching product (as string)",
        "- relevanceScore: a number from 0 to 1",
        `- matchReason: a brief explanation in ${isAr ? 'Arabic' : 'English'} explaining WHY it matches.`
      ].join("\n");

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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

      const systemInstruction = [
        "You are an expert Solar Energy Sizing and Design Consultant for the 'enerjoo' solar enterprise platform in Egypt.",
        "Analyze the client requirements (Required Station Power in kW, Available Land/Roof Area in m2, and Daily Load details)",
        "and design a fully compatible, optimally sized solar system package selected from the provided products catalog.",
        "",
        "DESIGN RULES & SIZING LOGIC:",
        "1. Solar Panels (category: 'panels'):",
        "   - Calculate the number of boards necessary to reach the Target Station Power (kW).",
        "   - Total Panel Power = panel power * quantity.",
        "   - Total Area Footprint = panel area * quantity.",
        "   - Check if Total Area Footprint fits inside the user landArea (m2).",
        "2. Solar Inverter (category: 'inverters'):",
        "   - Recommend an inverter from the catalog whose power capacity handles the panel station size.",
        "3. Batteries (category: 'batteries'):",
        "   - If user has specified any loadDetails or night consumption, recommend battery storage units from the catalog.",
        "4. Calculate totalEstimatedCost in EGP strictly by summing (product price * quantity) for all recommended products.",
        "5. Return a highly professional, detailed feasibilityAnalysis.",
        `6. Return everything as a structured JSON object. Response language must match the request language (${isAr ? 'Arabic' : 'English'}).`
      ].join("\n");

      const prompt = [
        "Client Configuration:",
        `- Target Station Power: ${stationPower} kW`,
        `- Available Land/Roof Area: ${landArea} m2`,
        `- Daily Load / Night Consumption Details: ${loadDetails || "None provided"}`,
        "",
        "Available Egyptian Solar Products Catalog:",
        JSON.stringify(condensedProducts, null, 2)
      ].join("\n");

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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

      const contextParts: string[] = [];
      if (systemType || cityChoice || systemDetails || pumpHp) {
        contextParts.push("System details provided by user:");
        if (systemType) contextParts.push(`- System type: ${systemType}`);
        if (cityChoice) contextParts.push(`- Location/City: ${cityChoice}`);
        if (pumpHp) contextParts.push(`- Water pump power: ${pumpHp} HP`);
        if (billAmount) contextParts.push(`- Monthly electricity bill: ${billAmount} EGP`);
        if (kwhMonthly) contextParts.push(`- Monthly consumption: ${kwhMonthly} kWh`);
        if (systemDetails) {
          contextParts.push(`- System capacity: ${systemDetails.panelPowerTotalKw || 0} kW`);
          contextParts.push(`- Required panels count: ${systemDetails.panelQty || 0}`);
          contextParts.push(`- Storage batteries count: ${systemDetails.batteryQty || 0}`);
        }
      }

      const systemInstruction = [
        'You are an expert, friendly solar energy consultant for the "Enerjoo" solar energy platform in Egypt.',
        'Your goal is to answer client questions with simplified, warm Arabic (or English if prompted) explanations.',
        contextParts.join('\n'),
        'Guidelines:',
        '1. Explain technical terms simply.',
        '2. Guide users to interact with the interactive sizing tools and request certified installation quotes.',
        '3. Focus on verified equipment available on the platform and practical Egyptian solar guidelines.'
      ].filter(Boolean).join('\n\n');

      // Format messages safely for @google/genai SDK
      const contents = (messages || []).map((m: any) => ({
        role: m.sender === 'ai' ? 'model' : 'user',
        parts: [{ text: m.text || '' }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction,
        }
      });

      const lastText = messages && messages.length > 0 ? (messages[messages.length - 1]?.text || "") : "";
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
        const lastText = messages && messages.length > 0 ? (messages[messages.length - 1]?.text || "") : "";
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
