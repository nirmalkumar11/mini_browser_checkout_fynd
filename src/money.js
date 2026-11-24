// Money is integer cents everywhere; only formatted for display.
export const formatCents = (cents) => `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
