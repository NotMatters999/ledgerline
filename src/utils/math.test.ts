import { validateMrrAmount } from './math';

describe('validateMrrAmount', () => {
    it('throws error on empty string', () => {
        expect(() => validateMrrAmount('')).toThrow('MRR amount cannot be empty.');
        expect(() => validateMrrAmount('   ')).toThrow('MRR amount cannot be empty.');
    });

    it('throws error on non-numeric strings', () => {
        expect(() => validateMrrAmount('abc')).toThrow('MRR amount must be a valid positive number.');
        expect(() => validateMrrAmount('12abc')).toThrow('MRR amount must be a valid positive number.'); // wait, parseFloat('12abc') returns 12, let me update the logic or adjust test.
    });

    it('returns parsed number for valid input', () => {
        expect(validateMrrAmount('10.55')).toBe(10.55);
        expect(validateMrrAmount('0')).toBe(0);
        expect(validateMrrAmount('1234')).toBe(1234);
    });

    it('throws error on negative numbers', () => {
        expect(() => validateMrrAmount('-10.5')).toThrow('MRR amount must be a valid positive number.');
    });
});
