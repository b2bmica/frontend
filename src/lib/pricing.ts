import { differenceInDays, parseISO, startOfDay } from 'date-fns';

export interface PricingParams {
  roomPrice: number;
  checkin: string | Date;
  checkout: string | Date;
  adults: number;
  baseOccupancy: number;
  extraPersonRate: number;
  planType: 'EP' | 'CP' | 'MAP' | 'AP' | 'custom';
  mealRates: Record<string, number>;
  mealRateOverride?: number;
  gstRates?: { cgst: number; sgst: number; enabled: boolean };
  isDayUse?: boolean;
  discount?: { type: 'percentage' | 'flat'; value: number };
}

export interface PricingResult {
  nights: number;
  baseSubtotal: number;
  extraAdults: number;
  extraCharge: number;
  mealCharge: number;
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  taxAmount: number;
  grandTotal: number;
  taxConfig?: { cgst: number; sgst: number; enabled: boolean };
}

export function calculateBookingPrice(params: PricingParams): PricingResult {
  const ci = typeof params.checkin === 'string' ? parseISO(params.checkin) : params.checkin;
  const co = typeof params.checkout === 'string' ? parseISO(params.checkout) : params.checkout;
  
  // Calculate nights using start of day to ensure full night counting
  const nights = Math.max(params.isDayUse ? 1 : 0, differenceInDays(startOfDay(co), startOfDay(ci)));
  
  const baseSubtotal = params.roomPrice * nights;
  const extraAdults = Math.max(0, params.adults - params.baseOccupancy);
  const extraCharge = extraAdults * params.extraPersonRate * nights;
  
  const mealRate = params.mealRateOverride ?? (params.mealRates[params.planType] || 0);
  const mealCharge = params.planType !== 'EP' ? mealRate * params.adults * nights : 0;
  
  const subtotal = baseSubtotal + extraCharge + mealCharge;
  
  // Apply Discount
  let discountAmount = 0;
  if (params.discount) {
    if (params.discount.type === 'percentage') {
      discountAmount = (subtotal * params.discount.value) / 100;
    } else {
      discountAmount = params.discount.value;
    }
  }
  
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  
  // Taxes
  const enabled = params.gstRates?.enabled ?? false;
  const cgstRate = params.gstRates?.cgst || 0;
  const sgstRate = params.gstRates?.sgst || 0;
  
  const cgst = Math.round(enabled ? (taxableAmount * cgstRate) / 100 : 0);
  const sgst = Math.round(enabled ? (taxableAmount * sgstRate) / 100 : 0);
  const taxAmount = cgst + sgst;
  
  return {
    nights,
    baseSubtotal: Math.round(baseSubtotal),
    extraAdults,
    extraCharge: Math.round(extraCharge),
    mealCharge: Math.round(mealCharge),
    subtotal: Math.round(subtotal),
    discountAmount: Math.round(discountAmount),
    taxableAmount: Math.round(taxableAmount),
    cgst,
    sgst,
    taxAmount,
    grandTotal: Math.round(taxableAmount + taxAmount),
    taxConfig: params.gstRates
  };
}
