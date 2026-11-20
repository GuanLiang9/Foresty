import { randomInt } from 'node:crypto';

// No 0/O or 1/I/L, so codes are easy to read out loud.
export const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = (n = 6) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
export const cleanCode = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
