export const UNIFIED_PHONE_DISPLAY = '01551509776';
export const UNIFIED_PHONE_INTL = '+201551509776';
export const UNIFIED_WHATSAPP_NUMBER = '201551509776';

export function getUnifiedWhatsAppUrl(message?: string): string {
  if (message) {
    return `https://wa.me/${UNIFIED_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/${UNIFIED_WHATSAPP_NUMBER}`;
}
