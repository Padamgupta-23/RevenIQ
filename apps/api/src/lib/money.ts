import { Prisma } from '@prisma/client';

export type DecimalValue = Prisma.Decimal.Value;

export function toDecimal(value: DecimalValue): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  return new Prisma.Decimal(value);
}

/**
 * Rounds half-up to 2 decimal places.
 */
export function round(value: DecimalValue): Prisma.Decimal {
  return toDecimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Adds multiple decimal values together and returns rounded result.
 */
export function add(...values: DecimalValue[]): Prisma.Decimal {
  if (values.length === 0) {
    return new Prisma.Decimal(0);
  }
  const sum = values.reduce<Prisma.Decimal>((acc, val) => {
    return acc.plus(toDecimal(val));
  }, new Prisma.Decimal(0));
  return round(sum);
}

/**
 * Subtracts b from a: (a - b) rounded to 2 decimal places.
 */
export function subtract(a: DecimalValue, b: DecimalValue): Prisma.Decimal {
  return round(toDecimal(a).minus(toDecimal(b)));
}

/**
 * Multiplies a and b: (a * b) rounded to 2 decimal places.
 */
export function multiply(a: DecimalValue, b: DecimalValue): Prisma.Decimal {
  return round(toDecimal(a).times(toDecimal(b)));
}

/**
 * Divides a by b: (a / b) rounded to 2 decimal places.
 */
export function divide(a: DecimalValue, b: DecimalValue): Prisma.Decimal {
  const divisor = toDecimal(b);
  if (divisor.isZero()) {
    throw new Error('Division by zero');
  }
  return round(toDecimal(a).dividedBy(divisor));
}

/**
 * Calculates percentage: round(base * rate / 100)
 */
export function percent(base: DecimalValue, rate: DecimalValue): Prisma.Decimal {
  return round(toDecimal(base).times(toDecimal(rate)).dividedBy(100));
}

/**
 * Formats a Decimal value as a string with exactly 2 decimal places (e.g. "1180.00").
 */
export function formatMoney(value: DecimalValue): string {
  return round(value).toFixed(2);
}

export function zero(): Prisma.Decimal {
  return new Prisma.Decimal(0);
}

export function isEqual(a: DecimalValue, b: DecimalValue): boolean {
  return toDecimal(a).equals(toDecimal(b));
}

export function isGreaterThan(a: DecimalValue, b: DecimalValue): boolean {
  return toDecimal(a).greaterThan(toDecimal(b));
}

export function isLessThan(a: DecimalValue, b: DecimalValue): boolean {
  return toDecimal(a).lessThan(toDecimal(b));
}

export function isPositive(value: DecimalValue): boolean {
  return toDecimal(value).greaterThan(0);
}

