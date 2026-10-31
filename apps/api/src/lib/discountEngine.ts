import { Prisma, DiscountType, DiscountScope } from '@prisma/client';
import {
  toDecimal,
  round,
  multiply,
  add,
  subtract,
  percent,
  DecimalValue,
} from './money';

export interface DiscountDefinition {
  id: string;
  name: string;
  type: DiscountType;
  value: DecimalValue;
  scope: DiscountScope;
  minPurchase?: DecimalValue | null;
  minQuantity?: number | null;
  startDate: Date | string;
  endDate: Date | string;
  usageLimit?: number | null;
  usedCount?: number;
  isActive: boolean;
  productIds?: string[];
}

export interface LineItemInput {
  productId: string;
  quantity: number;
  unitPrice: DecimalValue;
}

export interface EvaluateDiscountsInput {
  lines: LineItemInput[];
  subscriptionDiscount?: DiscountDefinition | null;
  productDiscounts?: DiscountDefinition[];
  now?: Date;
}

export interface AppliedDiscount {
  discountId: string;
  name: string;
  type: DiscountType;
  scope: DiscountScope;
  amount: Prisma.Decimal;
}

export interface LineDiscountResult {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  effectiveSubtotal: Prisma.Decimal;
}

export interface DiscountEvaluationResult {
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  totalAfterDiscount: Prisma.Decimal;
  appliedDiscounts: AppliedDiscount[];
  lineDiscounts: LineDiscountResult[];
}

/**
 * Validates whether a discount satisfies date validity, active flag, usage limits,
 * and purchase threshold conditions.
 */
function isDiscountValid(
  discount: DiscountDefinition,
  baseAmount: Prisma.Decimal,
  quantity: number,
  now: Date
): boolean {
  if (!discount.isActive) return false;

  const start = new Date(discount.startDate).getTime();
  const end = new Date(discount.endDate).getTime();
  const current = now.getTime();

  if (current < start || current > end) return false;

  if (
    discount.usageLimit !== null &&
    discount.usageLimit !== undefined &&
    (discount.usedCount || 0) >= discount.usageLimit
  ) {
    return false;
  }

  if (discount.minPurchase !== null && discount.minPurchase !== undefined) {
    const minPurchaseDec = toDecimal(discount.minPurchase);
    if (baseAmount.lessThan(minPurchaseDec)) return false;
  }

  if (discount.minQuantity !== null && discount.minQuantity !== undefined) {
    if (quantity < discount.minQuantity) return false;
  }

  return true;
}

/**
 * Pure discount evaluation engine adhering to AGENTS.md section 9.
 */
export function evaluateDiscounts(
  input: EvaluateDiscountsInput
): DiscountEvaluationResult {
  const now = input.now || new Date();
  const appliedDiscounts: AppliedDiscount[] = [];

  // Compute line subtotals
  const lineStates = input.lines.map((line) => {
    const unitPrice = round(line.unitPrice);
    const lineSubtotal = multiply(line.quantity, unitPrice);
    return {
      productId: line.productId,
      quantity: line.quantity,
      unitPrice,
      lineSubtotal,
      discountAmount: new Prisma.Decimal(0),
      effectiveSubtotal: lineSubtotal,
    };
  });

  const subtotal = add(...lineStates.map((l) => l.lineSubtotal));

  // 1. PRODUCT SCOPE DISCOUNTS (Apply first to matching product lines)
  const productDiscounts = input.productDiscounts || [];
  if (
    input.subscriptionDiscount &&
    input.subscriptionDiscount.scope === DiscountScope.PRODUCT
  ) {
    productDiscounts.push(input.subscriptionDiscount);
  }

  for (const disc of productDiscounts) {
    const targetProductIds = disc.productIds || [];
    const matchingLines = lineStates.filter((l) =>
      targetProductIds.includes(l.productId)
    );

    if (matchingLines.length === 0) continue;

    const matchingBase = add(...matchingLines.map((l) => l.effectiveSubtotal));
    const matchingQty = matchingLines.reduce((acc, l) => acc + l.quantity, 0);

    if (!isDiscountValid(disc, matchingBase, matchingQty, now)) continue;

    let discAmount = new Prisma.Decimal(0);
    if (disc.type === DiscountType.PERCENTAGE) {
      discAmount = percent(matchingBase, disc.value);
    } else {
      // FIXED: min(value, matchingBase)
      const fixedVal = round(disc.value);
      discAmount = fixedVal.greaterThan(matchingBase) ? matchingBase : fixedVal;
    }

    if (discAmount.greaterThan(0)) {
      appliedDiscounts.push({
        discountId: disc.id,
        name: disc.name,
        type: disc.type,
        scope: DiscountScope.PRODUCT,
        amount: discAmount,
      });

      // Distribute proportionately across matching lines
      let remaining = discAmount;
      for (let i = 0; i < matchingLines.length; i++) {
        const line = matchingLines[i];
        if (matchingBase.isZero()) break;

        const isLast = i === matchingLines.length - 1;
        const linePortion = isLast
          ? remaining
          : round(multiply(discAmount, line.effectiveSubtotal.dividedBy(matchingBase)));

        line.discountAmount = add(line.discountAmount, linePortion);
        line.effectiveSubtotal = subtract(line.lineSubtotal, line.discountAmount);
        remaining = subtract(remaining, linePortion);
      }
    }
  }

  // 2. SUBSCRIPTION SCOPE DISCOUNT (Applies to the entire subtotal)
  const subDiscount = input.subscriptionDiscount;
  if (subDiscount && subDiscount.scope === DiscountScope.SUBSCRIPTION) {
    const totalQty = input.lines.reduce((acc, l) => acc + l.quantity, 0);

    // Evaluate against the overall subtotal
    if (isDiscountValid(subDiscount, subtotal, totalQty, now)) {
      const currentRemainingSubtotal = add(
        ...lineStates.map((l) => l.effectiveSubtotal)
      );

      let subAmount = new Prisma.Decimal(0);
      if (subDiscount.type === DiscountType.PERCENTAGE) {
        subAmount = percent(currentRemainingSubtotal, subDiscount.value);
      } else {
        const fixedVal = round(subDiscount.value);
        subAmount = fixedVal.greaterThan(currentRemainingSubtotal)
          ? currentRemainingSubtotal
          : fixedVal;
      }

      if (subAmount.greaterThan(0)) {
        appliedDiscounts.push({
          discountId: subDiscount.id,
          name: subDiscount.name,
          type: subDiscount.type,
          scope: DiscountScope.SUBSCRIPTION,
          amount: subAmount,
        });

        // Apportion across lines
        let remaining = subAmount;
        for (let i = 0; i < lineStates.length; i++) {
          const line = lineStates[i];
          if (currentRemainingSubtotal.isZero()) break;

          const isLast = i === lineStates.length - 1;
          const linePortion = isLast
            ? remaining
            : round(
                multiply(
                  subAmount,
                  line.effectiveSubtotal.dividedBy(currentRemainingSubtotal)
                )
              );

          line.discountAmount = add(line.discountAmount, linePortion);
          line.effectiveSubtotal = subtract(line.lineSubtotal, line.discountAmount);
          remaining = subtract(remaining, linePortion);
        }
      }
    }
  }

  const discountTotal = add(...appliedDiscounts.map((d) => d.amount));
  const totalAfterDiscount = subtotal.greaterThan(discountTotal)
    ? subtract(subtotal, discountTotal)
    : new Prisma.Decimal(0);

  return {
    subtotal,
    discountTotal,
    totalAfterDiscount,
    appliedDiscounts,
    lineDiscounts: lineStates,
  };
}

