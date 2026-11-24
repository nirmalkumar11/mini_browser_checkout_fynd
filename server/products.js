// The only source of truth for prices. Money is integer cents.
export const PRODUCTS = [
  { id: 'tshirt', name: 'Classic T-Shirt', priceCents: 1999 },
  { id: 'mug', name: 'Coffee Mug', priceCents: 850 },
];

export const MAX_QTY = 99;
export const MAX_NAME_LENGTH = 100;

export const findProduct = (id) => PRODUCTS.find((p) => p.id === id);
