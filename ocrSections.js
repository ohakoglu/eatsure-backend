// ocrSections.js
// ===================================
// OCR Section Extractor + Sufficiency Evaluator
// TR/EN ağırlıklı, safety-first
// ===================================

// --- Normalize helpers ---
function normalize(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritics
    .replace(/[’‘´`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function countMatches(str, regex) {
  if (!str) return 0;
  const m = str.match(regex);
  return m ? m.length : 0;
}

function anyRegexMatch(str, regexList) {
  return regexList.some((rx) => rx.test(str));
}

function firstRegexMatch(str, regexList) {
  for (const rx of regexList) {
    const m = str.match(rx);
    if (m) return { rx, match: m[0] };
  }
  return null;
}

// --- Keyword/Regex sets ---

// Positive GF claim (front / labels / text)
const CLAIM_POSITIVE_PATTERNS = [
  /\bglutensiz\b/,
  /\bgluten\s*i[çc]ermez\b/,
  /\bgluten\s*yok\b/,
  /\bgluten[\s-]?free\b/,
  /\bno[\s-]?gluten\b/,
  /\bfree\s*from\s*gluten\b/,
  /\bwithout\s*gluten\b/,
  /\bglutenfrei\b/,
  /\bsans\s*gluten\b/,
  /\bsenza\s*glutine\b/,
  /\bsin\s*gluten\b/,
  /\bsem\s*gluten\b/
];

// Negative claim (explicit unsafe)
const CLAIM_NEGATIVE_PATTERNS = [
  /\bnot\s+safe\s+for\s+coeli?ac\b/,
  /\bnot\s+suitable\s+for\s+coeli?ac(s)?\b/,
  /\bcoeli?ac(s)?\s+not\s+safe\b/,
  /\bcoeli?ac(s)?\s+not\s+suitable\b/,
  /\bcolyak\s+i[çc]in\s+uygun\s+degil(dir)?\b/,
  /\bcolyak\s+hastalar[ıi]\s+i[çc]in\s+uygun\s+degil(dir)?\b/,
  /\bglutensiz\s+degil(dir)?\b/
];

// Ingredients section headers (multi-lang light)
const INGREDIENTS_HEADERS = [
  /\bingredients?\b/,
  /\bi[çc]indekiler\b/,
  /\bicerik\b/,
  /\bbile[şs]enler\b/,
  /\bzutaten\b/,
  /\bingr[ée]dients?\b/,
  /\bingredienti\b/,
  /\bingredientes\b/
];

// Allergen/traces headers & patterns
const ALLERGEN_HEADERS = [
  /\ballergens?\b/,
  /\ballergen\b/,
  /\balerjen(ler)?\b/,
  /\ballergene\b/,
  /\ballerg[èe]nes\b/,
  /\ballergeni\b/,
  /\bal[eé]rgenos\b/,
  /\balergenos\b/
];

const CONTAINS_PATTERNS = [
  /\bcontains?\b/,
  /\bi[çc]erir\b/,
  /\benth[äa]lt\b/,
  /\bcontient\b/,
  /\bcontiene\b/
];

const TRACES_PATTERNS = [
  /\bmay\s+contain\b/,
  /\bmay\s+contain\s+traces?\s+of\b/,
  /\btraces?\s+of\b/,
  /\bkann\b[^.]{0,60}\benthalten\b/,
  /\bpeut\s+contenir\b/,
  /\bpu[oò]\s+contenere\b/,
  /\beser\s+miktarda\b/,
  /\biz\s+miktarda\b/,
  /\bi[çc]erebilir\b/,
  /\bayn[ıi]\s+hatt(a|e)\b/,
  /\bayn[ıi]\s+tesis(te)?\b/,
  /\buretil(d|t)i[ğg]i\s+tesis\b/
];

// Gluten sources (broad) – used only for heuristics/validation, not a final verdict here
const GLUTEN_SOURCES = [
  /\bbugday\b/,
  /\bbu[ğg]day\b/,
  /\bwheat\b/,
  /\barpa\b/,
  /\bbarley\b/,
  /\bcavdar\b/,
  /\brye\b/,
  /\birmik\b/,
  /\bsemolina\b/,
  /\bgluten\b/
];

// --- Section extraction (best-effort) ---
// Approach: find header index; take window until next major header-like token.
function extractSectionByHeader(pool, headerRegexList) {
  const hit = pool.search(new RegExp(headerRegexList.map(r => r.source).join("|"), "i"));
  if (hit === -1) return "";

  // take from header to next header among ingredients/allergens (rough)
  const after = pool.slice(hit);
  const nextHeaderRx = new RegExp(
    [
      ...INGREDIENTS_HEADERS,
      ...ALLERGEN_HEADERS
    ]
      .map(r => r.source)
      .join("|"),
    "i"
  );

  // find the next header occurrence AFTER the first 10 chars (to avoid matching itself immediately)
  const rest = after.slice(10);
  const next = rest.search(nextHeaderRx);

  if (next === -1) return after.trim();
  return after.slice(0, 10 + next).trim();
}

// Claim is not a "section" per se; we just detect via keywords in the whole text.
function extractClaimText(pool) {
  const lines = pool.split(" ");
  // return a small snippet around first claim match to show user/debug
  for (const rx of CLAIM_POSITIVE_PATTERNS) {
    const idx = pool.search(rx);
    if (idx !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(pool.length, idx + 80);
      return pool.slice(start, end).trim();
    }
  }
  for (const rx of CLAIM_NEGATIVE_PATTERNS) {
    const idx = pool.search(rx);
    if (idx !== -1) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(pool.length, idx + 100);
      return pool.slice(start, end).trim();
    }
  }
  return "";
}

// --- Sufficiency evaluation ---
function evaluateClaim(pool) {
  const positive = anyRegexMatch(pool, CLAIM_POSITIVE_PATTERNS);
  const negative = anyRegexMatch(pool, CLAIM_NEGATIVE_PATTERNS);
  const snippet = extractClaimText(pool);

  return {
    present: positive || negative,
    sufficient: positive || negative, // claim detection itself is enough
    positive,
    negative,
    len: snippet.length,
    text: snippet
  };
}

function evaluateIngredients(ingredientsText, pool) {
  const text = ingredientsText || "";
  const len = text.length;
  const commas = countMatches(text, /[,;]/g);

  // present: header found OR "looks like ingredients list"
  const hasHeader = anyRegexMatch(pool, INGREDIENTS_HEADERS);
  const looksLikeList =
    len >= 40 &&
    (commas >= 2 || /%|e[-\s]?\d{3}/i.test(text) || /$begin:math:text$\[\^\)\]\{1\,40\}$end:math:text$/.test(text));

  const present = hasHeader || looksLikeList;

  // sufficient: more strict
  const sufficient =
    len >= 80 &&
    (commas >= 3 || /e[-\s]?\d{3}/i.test(text) || /%/.test(text));

  return {
    present,
    sufficient,
    len,
    commas
  };
}

function evaluateAllergens(allergensText, pool) {
  const text = allergensText || "";
  const len = text.length;

  const hasHeader = anyRegexMatch(pool, ALLERGEN_HEADERS);
  const hasContains = anyRegexMatch(text, CONTAINS_PATTERNS) || anyRegexMatch(pool, CONTAINS_PATTERNS);
  const hasTraces = anyRegexMatch(text, TRACES_PATTERNS) || anyRegexMatch(pool, TRACES_PATTERNS);

  const present = hasHeader || hasContains || hasTraces;

  // enough: small but not too tiny
  const sufficient = len >= 20 && (hasContains || hasTraces || hasHeader);

  return {
    present,
    sufficient,
    len,
    hasTraces
  };
}

// --- Main API: extract + evaluate + next-step decision ---
function extractAndEvaluate(ocrRawText = "") {
  const pool = normalize(ocrRawText);

  // Extract sections by headers (windowing)
  const ingredientsSection = extractSectionByHeader(pool, INGREDIENTS_HEADERS);
  const allergensSection = extractSectionByHeader(pool, ALLERGEN_HEADERS);

  // Claim from full pool
  const claimEval = evaluateClaim(pool);

  // Ingredients evaluation: if header-extracted is empty, fall back to pool heuristics (still pass empty for text)
  const ingEval = evaluateIngredients(ingredientsSection, pool);

  // Allergens evaluation
  const allEval = evaluateAllergens(allergensSection, pool);

  // Optional: quick heuristics for “gluten hints” (debug/admin)
  const glutenHints = anyRegexMatch(pool, GLUTEN_SOURCES);

  // Decide next prompt (priority: ingredients -> allergens -> claim)
  const missing = [];
  if (!ingEval.sufficient) missing.push("ingredients");
  if (!allEval.sufficient) missing.push("allergens");
  if (!claimEval.sufficient) missing.push("front_claim");

  let next = null;
  if (missing.includes("ingredients")) {
    next = {
      type: "ingredients",
      prompt:
        "Lütfen SADECE “İçindekiler / Ingredients” bölümünü yakından ve düz çek. Etiket silindir ise iki parçaya bölerek (sol + sağ) çek."
    };
  } else if (missing.includes("allergens")) {
    next = {
      type: "allergens",
      prompt:
        "Lütfen “Alerjen / Allergens” ve varsa “İz içerebilir / May contain” bölümünü yakından çek."
    };
  } else if (missing.includes("front_claim")) {
    next = {
      type: "front_claim",
      prompt:
        "Lütfen ambalajın ön yüzünü (glutensiz beyan/logo görünen kısım) çek."
    };
  }

  const done = missing.length === 0;

  return {
    extracted: {
      claimText: claimEval.text || "",
      ingredientsText: ingredientsSection || "",
      allergensText: allergensSection || ""
    },
    quality: {
      claim: claimEval,
      ingredients: ingEval,
      allergens: allEval
    },
    debug: { glutenHints },
    missing,
    next,
    done
  };
}

module.exports = {
  extractAndEvaluate,
  normalize
};
