// src/utils/validation.js
export const CATEGORY_PREFIX = {
  Asset: "1",
  Liability: "2",
  Equity: "3",
  Revenue: "4",
  Expense: "5",
};

export const isDigitsOnly = (s) => /^\d+$/.test(s);

export const hasCorrectPrefix = (category, number) => {
  const want = CATEGORY_PREFIX[category];
  if (!want) return true; // if category unknown, skip
  return String(number).startsWith(want);
};
