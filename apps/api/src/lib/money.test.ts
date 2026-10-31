import { describe, it, expect } from 'vitest';
import { add, subtract, multiply, divide, percent, round, formatMoney } from './money.js';
import { Prisma } from '@prisma/client';

describe('money lib', () => {
  it('rounds half-up to 2 decimal places correctly', () => {
    expect(round('10.005').toString()).toBe('10.01');
    expect(round('10.004').toString()).toBe('10');
    expect(formatMoney('10.005')).toBe('10.01');
    expect(formatMoney('10.004')).toBe('10.00');
    expect(formatMoney('10')).toBe('10.00');
  });

  it('performs addition without floating point inaccuracies', () => {
    const sum = add('0.1', '0.2');
    expect(sum.toString()).toBe('0.3');
    expect(formatMoney(sum)).toBe('0.30');
  });

  it('performs subtraction correctly', () => {
    const result = subtract('100.50', '25.25');
    expect(result.toString()).toBe('75.25');
  });

  it('performs multiplication with rounding', () => {
    const result = multiply('19.99', 3);
    expect(result.toString()).toBe('59.97');
  });

  it('performs percent calculation with half-up rounding', () => {
    // 18% tax on 1180 = 212.40
    const tax = percent('1180', '18');
    expect(tax.toString()).toBe('212.4');
    expect(formatMoney(tax)).toBe('212.40');

    // 18% on 55.55 = 9.999 -> 10.00
    const taxRounded = percent('55.55', '18');
    expect(taxRounded.toString()).toBe('10');
    expect(formatMoney(taxRounded)).toBe('10.00');
  });

  it('throws on division by zero', () => {
    expect(() => divide('100', 0)).toThrow('Division by zero');
  });
});
