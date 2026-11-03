/**
 * What a priced receipt line is. Keyword lists cover English, Portuguese, Spanish, French,
 * German, Italian, Dutch, and Japanese receipts, matched on a lowercased, accent-stripped
 * label so "Serviço" and "SERVICO" read the same.
 */
export type LineRole =
  'item' | 'subtotal' | 'tax' | 'tip' | 'fees' | 'discount' | 'total' | 'payment' | 'ignored';

export interface Classification {
  role: LineRole;
  /** Tax lines only: the label says the tax is already inside the prices. */
  taxIncluded?: boolean;
}

/** Informational lines that repeat money already counted elsewhere. */
const INFORMATIONAL =
  /\b(?:suggested|suggestion|tip guide|gratuity guide|you saved|your savings|total savings|savings today|ersparnis)\b/;

const PAYMENT_ANYWHERE =
  /\b(?:visa|mastercard|master card|amex|american express|maestro|girocard|ec-karte|debit|credit card|card payment|contactless|apple pay|google pay|tendered|tend|change due|change|amount paid|paid|payment|pagamento|pago|multibanco|mb way|troco|rendu|monnaie rendue|gegeben|ruckgeld|wechselgeld|auth code|approval|terminal|rounding|rundung|arrondi|gift card)\b|お預り|お預かり|預り|お釣り|釣銭/;
const PAYMENT_EXACT = /^(?:cash|card|bar|ec|cb|efectivo|dinheiro|especes|tarjeta|cartao|karte)$/;

const SUBTOTAL =
  /\b(?:sub[\s-]?total|subtot|zwischensumme|sous[\s-]?total|subtotaal|subtotale|net total|total excl|total sem iva|base imponible|netto|nettobetrag)\b|小計/;
const TAX =
  /\b(?:tax|taxes|sales tax|vat|iva|i\.v\.a|mwst|mehrwertsteuer|ust|tva|gst|hst|pst|qst|btw|moms|igic)\b|消費税|内税|外税/;
const TAX_INCLUDED =
  /\b(?:incl|inkl|included|including|incluido|incluida|inclus|incluse|enthalten|inbegriffen|inc)\b|内税|内消費税|税込/;
const TOTAL_TAX = /^(?:total|totale|summe)\s+(?:tax|vat|iva|mwst|tva|gst)\b/;
const TIP = /\b(?:tip|tips|gratuity|trinkgeld|pourboire|propina|gorjeta|mancia|fooi)\b|チップ/;
const FEES =
  /\b(?:service charge|service fee|servicio|servico|bedienung|coperto|cover charge|delivery fee|booking fee|surcharge|service)\b|サービス料/;
const DISCOUNT =
  /\b(?:discount|desconto|descuento|rabatt|remise|sconto|korting|promo|promotion|coupon|voucher|card savings|member savings|loyalty)\b|割引|値引/;
const TOTAL =
  /\b(?:total|totale|totaal|summe|gesamt|gesamtbetrag|endbetrag|brutto|amount due|balance due|to pay|a pagar|a payer|zu zahlen|importe|grand total|montant)\b|^amount$|合計|お会計|総額/;

export function fuzzyLabel(label: string): string {
  const lowered = label.toLowerCase();
  return typeof lowered.normalize === 'function'
    ? lowered.normalize('NFD').replace(/[̀-ͯ]/g, '')
    : lowered;
}

/**
 * Decides a priced line's role. Order matters: informational and payment lines are ruled
 * out first (a "TOTAL SAVINGS" line is not a total, "CHANGE DUE" is not a balance), then the
 * specific adjustments, then totals, and only then is a line treated as an item.
 */
export function classifyLine(label: string, isNegative: boolean): Classification {
  const text = fuzzyLabel(label);
  if (INFORMATIONAL.test(text)) return { role: 'ignored' };
  if (PAYMENT_EXACT.test(text.trim()) || PAYMENT_ANYWHERE.test(text)) return { role: 'payment' };
  if (SUBTOTAL.test(text)) return { role: 'subtotal' };
  if (TOTAL_TAX.test(text)) return { role: 'tax', taxIncluded: TAX_INCLUDED.test(text) };
  if (TAX.test(text) && !/^(?:total|summe|totale|totaal)\b/.test(text)) {
    return { role: 'tax', taxIncluded: TAX_INCLUDED.test(text) };
  }
  if (TIP.test(text)) return { role: 'tip' };
  if (FEES.test(text)) return { role: 'fees' };
  if (isNegative || DISCOUNT.test(text)) return { role: 'discount' };
  if (TOTAL.test(text)) return { role: 'total' };
  return { role: 'item' };
}

/** Labels that carry a price-looking number but are never an item. */
const NOT_AN_ITEM =
  /\b(?:table|tisch|mesa|guests|covers|server|cashier|kasse|order|receipt|invoice|fatura|factura|rechnung|nif|nipc|vat no|tax id|steuer-?nr|tel|phone|www|http|thank|obrigado|danke|merci|gracias)\b/;

export function looksLikeHeader(label: string): boolean {
  return NOT_AN_ITEM.test(fuzzyLabel(label));
}

/** A line that marks the start of a tip suggestion block, which has no real charges in it. */
export function startsSuggestions(label: string): boolean {
  return /\b(?:suggested|suggestion|tip guide|gratuity guide)\b/.test(fuzzyLabel(label));
}
