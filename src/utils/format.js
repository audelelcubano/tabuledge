// src/utils/format.js
export const formatMoney = (value) => {
  const n = Number.isFinite(value) ? value : parseFloat(value || 0);
  const rounded = Math.round(n * 100) / 100; // two decimals
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
};

export const parseMoney = (value) => {
  if (value === "" || value === null || value === undefined) return 0;
  // strip commas and parse
  const num = parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
};
