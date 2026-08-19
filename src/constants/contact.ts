export const UNIFIED_PHONE_DISPLAY = '01033253870';
export const UNIFIED_PHONE_INTL = '+201033253870';
export const UNIFIED_WHATSAPP_NUMBER = '201033253870';

export function getUnifiedWhatsAppUrl(message?: string): string {
  if (message) {
    return `https://wa.me/${UNIFIED_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }
  return `https://wa.me/${UNIFIED_WHATSAPP_NUMBER}`;
}
