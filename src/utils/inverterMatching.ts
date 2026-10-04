/**
 * Enerjoo Inverter AI Matching & Recommendation Engine
 * Used by:
 * - n8n AI Agent via POST /api/v1/inverters/match
 * - In-app Gemini Semantic Search & Solar Consultant
 * - Live UI smart recommendation drawer
 */

import {
  StructuredInverter,
  InverterType,
  InverterPhase,
  InverterApplication,
  InverterQueryCriteria,
  InverterMatchResult
} from '../types/inverter';

/**
 * Parses freeform natural language text (Arabic or English) into structured query criteria.
 */
export function parseInverterQuery(text: string): InverterQueryCriteria {
  const q = text.toLowerCase();
  const criteria: InverterQueryCriteria = {};

  // 1. Inverter Type
  const hasPumpHint = 
    q.includes('pump') || 
    q.includes('طلمب') || 
    q.includes('مضخ') || 
    q.includes('vfd') || 
    q.includes('غاطس') || 
    /(?:^|[^\u0621-\u064A])(?:ري|للري|مياه الري)(?:[^\u0621-\u064A]|$)/.test(q);

  if (hasPumpHint && !q.includes('بطار') && !q.includes('battery')) {
    criteria.type = 'Pump Inverter';
  } else if (q.includes('hybrid') || q.includes('هايبرد') || q.includes('هجين')) {
    criteria.type = 'Hybrid';
  } else if (q.includes('off-grid') || q.includes('off grid') || q.includes('اوف جريد') || q.includes('أوف جريد') || q.includes('منفصل')) {
    criteria.type = 'Off-Grid';
  } else if (q.includes('on-grid') || q.includes('on grid') || q.includes('اون جريد') || q.includes('أون جريد') || q.includes('متصل') || q.includes('شبكة')) {
    criteria.type = 'On-Grid';
  }

  // 2. Rated Power (kW)
  // Match patterns like: "100 كيلو", "100kw", "100 k", "100 كيلوواط", "15 kw", "10kw"
  const powerMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:kw|كيلوواط|كيلو|k|وات|w)/i);
  if (powerMatch) {
    let p = parseFloat(powerMatch[1]);
    if (q.includes('وات') && !q.includes('كيلو') && p > 500) {
      p = p / 1000;
    }
    criteria.rated_power_kw = p;
  } else {
    // Isolated numbers if explicitly preceded by power hints
    const isolatedNumMatch = q.match(/(?:قدرة|حجم|capacity|power)\s*(\d+(?:\.\d+)?)/i);
    if (isolatedNumMatch) {
      criteria.rated_power_kw = parseFloat(isolatedNumMatch[1]);
    }
  }

  // 3. Phase (Single Phase vs Three Phase)
  if (
    q.includes('3 فاز') || 
    q.includes('٣ فاز') || 
    q.includes('3-phase') || 
    q.includes('3 phase') || 
    q.includes('three phase') || 
    q.includes('ثلاثي') || 
    q.includes('380')
  ) {
    criteria.phase = 'Three Phase';
  } else if (
    q.includes('1 فاز') || 
    q.includes('١ فاز') || 
    q.includes('سنجل فاز') || 
    q.includes('1-phase') || 
    q.includes('1 phase') || 
    q.includes('single phase') || 
    q.includes('أحادي') || 
    q.includes('220')
  ) {
    criteria.phase = 'Single Phase';
  }

  // 4. Battery Requirement
  if (
    q.includes('بدون بطارية') || 
    q.includes('من غير بطارية') || 
    q.includes('no battery') || 
    q.includes('without battery')
  ) {
    criteria.battery_required = false;
  } else if (
    q.includes('مع بطارية') || 
    q.includes('بطاريات') || 
    q.includes('بطارية') || 
    q.includes('with battery') || 
    q.includes('battery backup') || 
    criteria.type === 'Off-Grid'
  ) {
    criteria.battery_required = true;
  }

  // 5. Application
  if (q.includes('مصنع') || q.includes('معمل') || q.includes('صناعي') || q.includes('industrial') || q.includes('factory')) {
    criteria.application = 'Industrial';
  } else if (q.includes('محل') || q.includes('تجاري') || q.includes('شرك') || q.includes('مكتب') || q.includes('commercial') || q.includes('office')) {
    criteria.application = 'Commercial';
  } else if (q.includes('بيت') || q.includes('منزل') || q.includes('فيلا') || q.includes('شقة') || q.includes('سكني') || q.includes('residential') || q.includes('home')) {
    criteria.application = 'Residential';
  } else if (q.includes('مزرع') || q.includes('أرض') || q.includes('ري') || q.includes('agricultural') || q.includes('farm')) {
    criteria.application = 'Agricultural';
  } else if (criteria.type === 'Pump Inverter' || q.includes('طلمب') || q.includes('pumping')) {
    criteria.application = 'Solar Pumping';
  }

  // If user asked for Hybrid and mentioned battery, confirm battery_required
  if (criteria.type === 'Hybrid' && (q.includes('بطار') || q.includes('battery'))) {
    criteria.battery_required = true;
  }

  // Default battery requirement based on type if not explicitly set
  if (criteria.battery_required === undefined) {
    if (criteria.type === 'On-Grid' || criteria.type === 'Pump Inverter') {
      criteria.battery_required = false;
    } else if (criteria.type === 'Off-Grid') {
      criteria.battery_required = true;
    }
  }

  return criteria;
}

/**
 * Matches an array of StructuredInverters against customer criteria,
 * evaluating compatibility and computing a composite score (0-100).
 */
export function matchInverters(
  inverters: StructuredInverter[],
  criteria: InverterQueryCriteria
): InverterMatchResult[] {
  const results: InverterMatchResult[] = [];

  for (const inv of inverters) {
    let score = 0;
    let isCompatible = true;

    // 1. Type Match (Weight: 30 pts)
    let typeMatch = true;
    if (criteria.type) {
      if (inv.type === criteria.type) {
        score += 30;
      } else {
        // Cross compatibility (e.g. Hybrid can function in some Off-grid cases, but strictly penalized)
        typeMatch = false;
        isCompatible = false;
      }
    } else {
      score += 20; // No preference specified
    }

    // 2. Battery Compatibility Check (Weight: 20 pts)
    let batteryMatch = true;
    if (criteria.battery_required !== undefined) {
      if (criteria.battery_required) {
        if (inv.battery_support) {
          score += 20;
        } else {
          // Hard incompatibility: User requested battery, but inverter has NO battery support (e.g. pure On-Grid)
          batteryMatch = false;
          isCompatible = false;
          score -= 40;
        }
      } else {
        // Battery not required
        if (!inv.battery_support) {
          score += 20;
        } else {
          // Inverter has battery capability, still usable for Hybrid, but pure on-grid preferred
          score += 10;
        }
      }
    } else {
      score += 15;
    }

    // 3. Power Proximity (Weight: 25 pts)
    let powerDiffKw = 0;
    let powerScore = 0;
    if (criteria.rated_power_kw && criteria.rated_power_kw > 0) {
      powerDiffKw = Math.abs(inv.rated_power_kw - criteria.rated_power_kw);
      const relativeDiff = powerDiffKw / criteria.rated_power_kw;

      if (relativeDiff === 0) {
        // Exact match
        powerScore = 25;
      } else if (relativeDiff <= 0.15) {
        // Within 15% (e.g. 10kW vs 11kW or 100kW vs 115kW)
        powerScore = 22;
      } else if (relativeDiff <= 0.30) {
        // Within 30%
        powerScore = 15;
      } else if (relativeDiff <= 0.50) {
        powerScore = 8;
      } else {
        // Power difference too large (e.g. asking 100kW and getting 10kW)
        powerScore = 0;
        if (relativeDiff > 0.8) {
          isCompatible = false;
        }
      }
      score += powerScore;
    } else {
      score += 15;
    }

    // 4. Phase Match (Weight: 10 pts)
    let phaseMatch = true;
    if (criteria.phase) {
      if (inv.phase === criteria.phase) {
        score += 10;
      } else {
        phaseMatch = false;
        // Severe penalty if phase does not match (e.g. factory needs 3-phase, single phase won't run motors)
        score -= 20;
        isCompatible = false;
      }
    } else {
      score += 10;
    }

    // 5. Application Match (Weight: 10 pts)
    let applicationMatch = true;
    if (criteria.application) {
      if (inv.application.includes(criteria.application)) {
        score += 10;
      } else {
        applicationMatch = false;
        score += 2;
      }
    } else {
      score += 5;
    }

    // 6. Efficiency & Technical Specs (Weight: 5 pts)
    let efficiencyScore = 0;
    if (typeof inv.efficiency_percent === 'number') {
      if (inv.efficiency_percent >= 98.5) efficiencyScore = 5;
      else if (inv.efficiency_percent >= 95) efficiencyScore = 4;
      else efficiencyScore = 3;
    } else {
      efficiencyScore = 2;
    }
    score += efficiencyScore;

    // 7. Availability (Availability Match)
    const availabilityMatch = inv.availability;
    if (!availabilityMatch) {
      score -= 15;
    }

    // Normalize final score between 0 and 100
    const finalScore = Math.max(0, Math.min(100, Math.round(score)));

    // Generate human-friendly reasoning
    const reasonsAr: string[] = [];
    const reasonsEn: string[] = [];

    if (typeMatch && criteria.type) {
      reasonsAr.push(`مطابق للنوع المطلوب (${inv.type})`);
      reasonsEn.push(`Matches requested type (${inv.type})`);
    }
    if (criteria.rated_power_kw) {
      if (powerDiffKw === 0) {
        reasonsAr.push(`القدرة مطابقة تماماً (${inv.rated_power_kw} kW)`);
        reasonsEn.push(`Exact power match (${inv.rated_power_kw} kW)`);
      } else {
        reasonsAr.push(`القدرة قريبة (${inv.rated_power_kw} kW بفارق ${powerDiffKw.toFixed(1)} kW)`);
        reasonsEn.push(`Close capacity (${inv.rated_power_kw} kW, diff ${powerDiffKw.toFixed(1)} kW)`);
      }
    }
    if (phaseMatch && criteria.phase) {
      reasonsAr.push(`متوافق مع الطور (${inv.phase})`);
      reasonsEn.push(`Compatible with grid phase (${inv.phase})`);
    }
    if (criteria.battery_required !== undefined) {
      if (criteria.battery_required && inv.battery_support) {
        reasonsAr.push('يدعم بنك البطاريات المطلوب');
        reasonsEn.push('Supports required battery storage');
      } else if (!criteria.battery_required && !inv.battery_support) {
        reasonsAr.push('تصميم مباشر للشبكة بدون حاجة لبطاريات');
        reasonsEn.push('Direct on-grid without battery overhead');
      }
    }
    if (criteria.application && inv.application.includes(criteria.application)) {
      reasonsAr.push(`مثالي للاستخدام (${criteria.application})`);
      reasonsEn.push(`Ideal for ${criteria.application} applications`);
    }

    results.push({
      product: inv,
      score: finalScore,
      isCompatible,
      matchBreakdown: {
        typeMatch,
        powerDiffKw,
        powerProximityScore: powerScore,
        phaseMatch,
        batteryMatch,
        applicationMatch,
        efficiencyScore,
        availabilityMatch,
      },
      recommendationReason: reasonsEn.join(' • ') || 'Verified product from Enerjoo catalog',
      recommendationReasonAr: reasonsAr.join(' • ') || 'منتج معتمد من كتالوج إينرجو الحقيقي',
    });
  }

  // Rank according to the 10-step AI Recommendation Logic:
  // 1. Compatibility
  // 2. Score (composite of type, power, phase, battery, application, efficiency)
  // 3. Availability
  // 4. Lowest power diff
  // 5. Price
  results.sort((a, b) => {
    // Compatible products first
    if (a.isCompatible && !b.isCompatible) return -1;
    if (!a.isCompatible && b.isCompatible) return 1;

    // Higher score first
    if (b.score !== a.score) return b.score - a.score;

    // Available items first
    if (a.product.availability && !b.product.availability) return -1;
    if (!a.product.availability && b.product.availability) return 1;

    // Closer power match
    if (a.matchBreakdown.powerDiffKw !== b.matchBreakdown.powerDiffKw) {
      return a.matchBreakdown.powerDiffKw - b.matchBreakdown.powerDiffKw;
    }

    // Lower price
    return a.product.price - b.product.price;
  });

  return results;
}
