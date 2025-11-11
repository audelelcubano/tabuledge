// src/utils/financials.js
import { Timestamp } from "firebase/firestore";

/** True if account's normal balance is debit (Assets, Expenses, or explicitly set) */
export function isDebitNormal(account) {
  const side = (account?.normalSide || "").toLowerCase();
  if (side === "debit") return true;
  if (side === "credit") return false;
  const cat = account?.category;
  return cat === "Asset" || cat === "Expense";
}

/** Normalize the range to JS times; open-ended allowed */
export function normalizeRange(from, to) {
  const fromMs = from ? new Date(from).getTime() : -Infinity;
  const toMs   = to   ? new Date(to).getTime()   : +Infinity;
  return { fromMs, toMs };
}

/**
 * Build a map of per-account activity & end balance for a date range.
 * - Accounts: [{id, name, number, category, subcategory, normalSide, initialBalance}]
 * - Ledger entries: [{accountId, debit, credit, createdAt(Timestamp)|date(Timestamp)}]
 */
export function computeBalances(accounts, ledgerEntries, from, to) {
  const { fromMs, toMs } = normalizeRange(from, to);
  const accMap = new Map();
  accounts.forEach(a => {
    accMap.set(a.id, {
      account: a,
      debitTotal: 0,
      creditTotal: 0,
      begin: Number(a.initialBalance || 0),
      end: Number(a.initialBalance || 0),
    });
  });

  const pickWhen = (e) => {
    const t = e.date?.toDate?.() || e.createdAt?.toDate?.() || null;
    return t ? t.getTime() : null;
  };

  for (const e of ledgerEntries) {
    const when = pickWhen(e);
    if (when == null || when < fromMs || when > toMs) continue;
    const rec = accMap.get(e.accountId);
    if (!rec) continue;
    const d = Number(e.debit || 0);
    const c = Number(e.credit || 0);
    rec.debitTotal += d;
    rec.creditTotal += c;

    const debitNormal = isDebitNormal(rec.account);
    rec.end = debitNormal
      ? rec.end + d - c
      : rec.end + c - d;
  }

  return accMap; // Map<accountId, {account, debitTotal, creditTotal, begin, end}>
}

/** Trial balance rows: {account, debit, credit} where debit/credit are column values */
export function trialBalanceRows(accMap) {
  const rows = [];
  let totalD = 0, totalC = 0;

  for (const { account, end } of accMap.values()) {
    const debitNormal = isDebitNormal(account);
    const val = Number(end || 0);
    const debit = debitNormal ? Math.max(val, 0) : Math.max(-val, 0);
    const credit = debitNormal ? Math.max(-val, 0) : Math.max(val, 0);
    rows.push({ account, debit, credit });
    totalD += debit;
    totalC += credit;
  }
  return { rows, totalD, totalC };
}

/** Income statement: sum by Revenue/Expense */
export function incomeStatement(accMap) {
  let revenue = 0, expenses = 0;
  for (const { account, end } of accMap.values()) {
    const cat = account.category;
    if (cat === "Revenue") revenue += Number(end || 0);
    if (cat === "Expense") expenses += Number(end || 0);
  }
  const netIncome = revenue - expenses;
  return { revenue, expenses, netIncome };
}

/** Balance sheet buckets & retained earnings */
export function balanceSheet(accMap, retainedEarningsOpening = 0, periodNetIncome = 0) {
  const buckets = { assets: 0, liabilities: 0, equity: 0 };
  for (const { account, end } of accMap.values()) {
    const cat = account.category;
    const n = Number(end || 0);
    if (cat === "Asset") buckets.assets += n;
    if (cat === "Liability") buckets.liabilities += n;
    if (cat === "Equity") buckets.equity += n;
  }
  // Add retained earnings into equity (opening + period NI)
  const retainedEarnings = Number(retainedEarningsOpening || 0) + Number(periodNetIncome || 0);
  const equityTotal = buckets.equity + retainedEarnings;
  return { ...buckets, retainedEarnings, equityTotal };
}

/** Retained earnings statement */
export function retainedEarningsStatement(opening, netIncome, dividends = 0) {
  const ending = Number(opening || 0) + Number(netIncome || 0) - Number(dividends || 0);
  return { opening: Number(opening || 0), netIncome: Number(netIncome || 0), dividends: Number(dividends || 0), ending };
}

/** Convenience: serialize a Timestamp-safe report payload */
export function serializeReport(obj) {
  const replacer = (_k, v) => (v instanceof Timestamp ? v.toDate().toISOString() : v);
  return JSON.parse(JSON.stringify(obj, replacer));
}
