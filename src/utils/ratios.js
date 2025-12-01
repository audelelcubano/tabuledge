// Safe divide – returns null on invalid or zero denominator
function safeDivide(numerator, denominator) {
  const n = Number(numerator);
  const d = Number(denominator);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

// Formatting helpers
function formatRatio(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(digits)}x`;
}

function formatPercent(value, digits = 1) {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatMoney(value, digits = 2) {
  if (value == null || !Number.isFinite(Number(value))) return "N/A";
  const num = Number(value);
  return num.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// Banding helpers
function bandHigherIsBetter(value, goodMin, warnMin) {
  if (value == null || !Number.isFinite(value)) return "warning";
  if (value >= goodMin) return "good";
  if (value >= warnMin) return "warning";
  return "bad";
}

function bandLowerIsBetter(value, goodMax, warnMax) {
  if (value == null || !Number.isFinite(value)) return "warning";
  if (value <= goodMax) return "good";
  if (value <= warnMax) return "warning";
  return "bad";
}

/**
 * Compute ratios using normalized totals from financials.js.
 * Input fields:
 *  - currentAssets
 *  - inventory
 *  - currentLiabilities
 *  - totalLiabilities
 *  - totalEquity
 *  - totalAssets
 *  - netIncome
 *  - revenue
 */
export function computeRatios(raw) {
  const currentAssets      = Number(raw.currentAssets || 0);
  const inventory          = Number(raw.inventory || 0);
  const currentLiabilities = Number(raw.currentLiabilities || 0);
  const totalLiabilities   = Number(raw.totalLiabilities || 0);
  const totalEquity        = Number(raw.totalEquity || 0);
  const totalAssets        = Number(raw.totalAssets || 0);
  const netIncome          = Number(raw.netIncome || 0);
  const revenue            = Number(raw.revenue || 0);

  // Quick assets derived unless provided
  const quickAssets = raw.quickAssets != null
    ? Number(raw.quickAssets)
    : currentAssets - inventory;

  // Ratios
  const currentRatioVal = safeDivide(currentAssets, currentLiabilities);
  const quickRatioVal   = safeDivide(quickAssets, currentLiabilities);
  const debtEquityVal   = safeDivide(totalLiabilities, totalEquity);
  const netMarginVal    = safeDivide(netIncome, revenue);
  const roaVal          = safeDivide(netIncome, totalAssets);
  const workingCapital  = currentAssets - currentLiabilities;

  // Banding
  const currentRatioStatus = bandHigherIsBetter(currentRatioVal, 2.0, 1.5);
  const quickRatioStatus   = bandHigherIsBetter(quickRatioVal, 1.0, 0.7);
  const debtEquityStatus   = bandLowerIsBetter(debtEquityVal, 1.0, 2.0);
  const netMarginStatus    = bandHigherIsBetter(netMarginVal, 0.15, 0.05);
  const roaStatus          = bandHigherIsBetter(roaVal, 0.10, 0.03);
  const workingStatus      = workingCapital > 0 ? "good" : workingCapital < 0 ? "bad" : "warning";

  return [
    {
      key: "currentRatio",
      label: "Current Ratio",
      formula: "Current Assets ÷ Current Liabilities",
      value: currentRatioVal,
      formatted: formatRatio(currentRatioVal),
      status: currentRatioStatus,
    },
    {
      key: "quickRatio",
      label: "Quick Ratio",
      formula: "Quick Assets ÷ Current Liabilities",
      value: quickRatioVal,
      formatted: formatRatio(quickRatioVal),
      status: quickRatioStatus,
    },
    {
      key: "debtToEquity",
      label: "Debt-to-Equity",
      formula: "Total Liabilities ÷ Total Equity",
      value: debtEquityVal,
      formatted: formatRatio(debtEquityVal),
      status: debtEquityStatus,
    },
    {
      key: "netMargin",
      label: "Net Profit Margin",
      formula: "Net Income ÷ Revenue",
      value: netMarginVal,
      formatted: formatPercent(netMarginVal),
      status: netMarginStatus,
    },
    {
      key: "returnOnAssets",
      label: "Return on Assets",
      formula: "Net Income ÷ Total Assets",
      value: roaVal,
      formatted: formatPercent(roaVal),
      status: roaStatus,
    },
    {
      key: "workingCapital",
      label: "Working Capital",
      formula: "Current Assets − Current Liabilities",
      value: workingCapital,
      formatted: formatMoney(workingCapital),
      status: workingStatus,
    },
  ];
}
