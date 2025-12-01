// src/utils/financials.js
import { Timestamp } from "firebase/firestore";

/**
 * Normalize Firestore account format → expected fields.
 */
export function normalizeAccount(a) {
  const type = (a.category || "").toLowerCase();
  return {
    ...a,
    type,
    number: String(a.number || ""),
  };
}

/** True if account's normal balance is debit (Assets, Expenses, or normalSide=Debit) */
export function isDebitNormal(account) {
  const side = (account?.normalSide || "").toLowerCase();
  if (side === "debit") return true;
  if (side === "credit") return false;

  const cat = (account?.category || "").toLowerCase();
  return cat === "asset" || cat === "expense";
}

/** Normalize date range for filtering */
export function normalizeRange(from, to) {
  const fromMs = from ? new Date(from).getTime() : -Infinity;
  const toMs = to ? new Date(to).getTime() : +Infinity;
  return { fromMs, toMs };
}

/**
 * Build account balances for a date range.
 */
export function computeBalances(accounts, ledgerEntries, from, to) {
  const { fromMs, toMs } = normalizeRange(from, to);

  accounts = accounts.map(normalizeAccount);

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
    // Firestore Timestamp
    const ts = e.date?.toDate?.() || e.createdAt?.toDate?.();
    if (ts) return ts.getTime();

    // String-based date
    if (typeof e.date === "string") {
      const parsed = new Date(e.date);
      if (!isNaN(parsed)) return parsed.getTime();
    }
    if (typeof e.createdAt === "string") {
      const parsed = new Date(e.createdAt);
      if (!isNaN(parsed)) return parsed.getTime();
    }

    // Fallback — treat as earliest
    return 0;
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
    rec.end = debitNormal ? rec.end + d - c : rec.end + c - d;
  }

  return accMap;
}

/**
 * Income statement totals (Revenue – Expenses)
 */
export function incomeStatement(accMap) {
  let revenue = 0, expenses = 0;

  for (const { account, end } of accMap.values()) {
    const cat = (account.category || "").toLowerCase();
    const n = Number(end || 0);

    if (cat === "revenue") revenue += n;
    if (cat === "expense") expenses += n;
  }

  const netIncome = revenue - expenses;
  return { revenue, expenses, netIncome };
}


export function balanceSheet(accMap, retainedEarningsOpening = 0, periodNetIncome = 0) {
  let currentAssets = 0;
  let inventory = 0;
  let currentLiabilities = 0;

  let totalAssets = 0;
  let totalLiabilities = 0;
  let equity = 0;

  for (const { account, end } of accMap.values()) {
    const amount = Number(end || 0);
    const cat = (account.category || "").toLowerCase();
    const sub = (account.subcategory || "").toLowerCase();

    // ASSETS
    if (cat === "asset") {
      totalAssets += amount;
      currentAssets += amount;

      // Detect inventory by label
      if (sub.includes("inventory")) {
        inventory += amount;
      }
    }

    // LIABILITIES
    else if (cat === "liability") {
      totalLiabilities += amount;
      currentLiabilities += amount;
    }

    // EQUITY
    else if (cat === "equity") {
      equity += amount;
    }
  }

  const retainedEarnings =
    Number(retainedEarningsOpening || 0) + Number(periodNetIncome || 0);

  const totalEquity = equity + retainedEarnings;

  return {
    currentAssets,
    inventory,
    currentLiabilities,
    totalLiabilities,
    totalAssets,
    totalEquity,
  };
}

/**
 * Retained earnings statement
 */
export function retainedEarningsStatement(opening, netIncome, dividends = 0) {
  const ending =
    Number(opening || 0) + Number(netIncome || 0) - Number(dividends || 0);

  return {
    opening: Number(opening || 0),
    netIncome: Number(netIncome || 0),
    dividends: Number(dividends || 0),
    ending,
  };
}

/**
 * Timestamp-safe serializer
 */
export function serializeReport(obj) {
  const replacer = (_k, v) =>
    v instanceof Timestamp ? v.toDate().toISOString() : v;
  return JSON.parse(JSON.stringify(obj, replacer));
}

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
