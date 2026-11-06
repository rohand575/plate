// @ts-check
import OpenAI, { toFile } from 'openai';
import { requireEnv } from './http.js';

/**
 * @typedef {{ name: string; quantity: number; unit: string; grams: number | null; kcal: number;
 *   protein: number; carbs: number; fat: number; assumption: string | null }} AnalyzedItem
 * @typedef {'label' | 'web' | 'estimate'} Basis
 * @typedef {{ title: string; items: AnalyzedItem[]; confidence: 'high' | 'medium' | 'low'; note: string | null;
 *   tip: string | null; basis: Basis; sourceUrl: string | null }} MealAnalysis
 * @typedef {{ roti: string; katori: string; oil: string; ghee: string; milk: string; note: string }} Kitchen
 */

const analysisModel = () => process.env.OPENAI_MODEL || 'gpt-6.1-terra';
const transcribeModel = () => process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-transcribe';
const reasoningEffort = () => process.env.OPENAI_REASONING_EFFORT ?? 'low';
/** Lets the model look up branded products online. Set OPENAI_WEB_SEARCH=off to disable. */
const webSearch = () => process.env.OPENAI_WEB_SEARCH !== 'off';

/** @type {OpenAI | undefined} */
let client;
const openai = () => (client ??= new OpenAI({ apiKey: requireEnv('OPENAI_API_KEY'), timeout: 45_000, maxRetries: 1 }));

// Spelling hints so dish names come through correctly.
const FOOD_WORDS = [
  'roti', 'chapati', 'phulka', 'paratha', 'thepla', 'puri', 'naan', 'dal', 'sabzi', 'bhaji', 'paneer', 'bhurji',
  'poha', 'upma', 'idli', 'dosa', 'uttapam', 'sambar', 'chutney', 'biryani', 'pulao', 'khichdi', 'rajma', 'chole',
  'kadhi', 'raita', 'dahi', 'curd', 'ghee', 'katori', 'chai', 'lassi', 'chaas', 'misal', 'vada pav', 'pav bhaji',
  'sheera', 'halwa', 'laddoo', 'besan', 'atta', 'tablespoon', 'teaspoon',
];

/**
 * @param {Buffer} audio
 * @param {string} mimeType
 */
export async function transcribe(audio, mimeType) {
  const type = mimeType.split(';')[0];
  const ext = /mp4|m4a|aac/.test(type) ? 'm4a' : /mpeg|mp3/.test(type) ? 'mp3' : /wav/.test(type) ? 'wav' : 'webm';
  const model = transcribeModel();
  const result = await openai().audio.transcriptions.create({
    file: await toFile(audio, `meal.${ext}`, { type }),
    model,
    language: 'en',
    prompt:
      'Someone describing food and drink they just had, often Indian home cooking, with amounts like tablespoons of oil, katoris of dal or numbers of rotis.',
    ...(model.startsWith('gpt-transcribe') ? { keywords: FOOD_WORDS } : {}),
  });
  return result.text.trim();
}

const INSTRUCTIONS = `You estimate calories and macronutrients for a calorie-tracking app. Most people using it live in India and eat home-cooked Indian food, but handle any cuisine.

Split the meal into items: one per distinct food or drink. For each item give the quantity in a natural singular unit (egg, roti, katori, cup, glass, slice, piece, tbsp, tsp, g, ml, plate, serving), the estimated weight in grams, kcal, and protein, carbs and fat in grams.

How to estimate:
- Use the quantities the person gives. If a quantity is missing, assume one typical home serving and say so in "assumption".
- Cooking fat is the biggest hidden source of calories. When the person states an amount of oil, ghee or butter, list it as its own item (1 tbsp oil ≈ 13.5 g ≈ 120 kcal; 1 tsp ghee ≈ 5 g ≈ 45 kcal). When they don't, include a typical home amount inside the dish and mention it in "assumption".
- Indian measures: 1 katori ≈ 150 ml; 1 medium roti or chapati without ghee ≈ 35 g atta ≈ 105 kcal; 1 cup cooked rice ≈ 150 g ≈ 195 kcal; 1 glass ≈ 250 ml; 1 large egg ≈ 72 kcal. Restaurant and street food portions are bigger and oilier than home portions.
- Be realistic rather than optimistic, especially for fried, restaurant and sweet foods.
- Round kcal to the nearest 5 and macros to whole grams. Keep kcal within about 10% of 4×protein + 4×carbs + 9×fat.
- "assumption" is one short sentence about anything you guessed (portion, ingredients, cooking fat), or null when the person specified everything.
- Never ask questions; always give your best estimate.

For photos: identify every visible food, judge portions from the plate, bowl and cutlery, and use any note the person adds.

Packaged and branded food (ready meals, snacks, biscuits, drinks, chain-restaurant items) has exact published values, so don't guess them:
- If a nutrition label is visible, copy its values. Set "basis" to "label".
- Otherwise, if you can tell the brand and product (from the pack or the person's words), search the web for its nutrition facts per 100 g or per pack. Prefer the brand's own site, retailer listings and nutrition databases that quote the label. Set "basis" to "web" and "source_url" to the page you used. If nothing reliable turns up, estimate from similar products and set "basis" to "estimate".
- Read the net weight from the pack when you can. Assume the whole pack for single-serve packs (ready meals, chips, chocolate bars, bottled drinks) and one labelled serving for multi-serve packs (biscuits, namkeen, cereal), unless the person says how much they had.
- Use the unit "pack" with quantity 1 (or a natural count such as "biscuit"), with grams from the net weight, and say in "assumption" how much of the pack you assumed.
- Never search for home-cooked, street or unbranded food; estimate it as described above with "basis" set to "estimate" and "source_url" null.

When the person describes their kitchen (roti size, katori size, how much oil or ghee they use, their milk), use that as the default for home-cooked food whenever the meal itself doesn't say otherwise. It overrides the typical values above. It doesn't apply to packaged or restaurant food.

"title" is a short natural name for the whole meal, at most 40 characters, e.g. "Egg bhurji with toast".
"confidence" is high when quantities were clear, medium for typical-serving guesses, low when the photo or description is ambiguous.
"tip" is one short, practical way to make this meal lighter, with the kcal it saves, e.g. "Skip the ghee on the rotis: −90 kcal". Prefer the change that saves the most for the least effort. Use null when the meal is already light or nothing sensible would help.
If the input isn't about food or drink, return no items and explain briefly in "note"; otherwise "note" is null.`;

/** @type {Record<string, Record<string, string>>} */
const KITCHEN_TEXT = {
  roti: {
    small: 'Rotis are small and thin (about 25 g atta, ~80 kcal each).',
    medium: 'Rotis are medium (about 35 g atta, ~105 kcal each).',
    large: 'Rotis are large or thick (about 50 g atta, ~150 kcal each).',
  },
  katori: {
    small: 'A katori holds about 100 ml.',
    medium: 'A katori holds about 150 ml.',
    large: 'A katori holds about 250 ml.',
  },
  oil: {
    light: 'Cooking uses little oil: about 1 tsp per serving of sabzi or dal.',
    medium: 'Cooking uses a moderate amount of oil: about 2 tsp per serving of sabzi or dal.',
    heavy: 'Cooking is generous with oil: about 1 tbsp or more per serving of sabzi or dal.',
  },
  ghee: {
    rarely: 'Ghee is rarely added on top of rotis, rice or dal.',
    sometimes: 'Ghee is sometimes added on top of rotis, rice or dal.',
    usually: 'Ghee is usually added on top of rotis, rice or dal: about 1 tsp per serving.',
  },
  milk: {
    full: 'Milk (for chai, coffee, dahi) is full-cream.',
    toned: 'Milk (for chai, coffee, dahi) is toned.',
    skimmed: 'Milk (for chai, coffee, dahi) is skimmed.',
  },
};

const KITCHEN_KEYS = /** @type {const} */ (['roti', 'katori', 'oil', 'ghee', 'milk']);
const KITCHEN_DEFAULTS = { roti: 'medium', katori: 'medium', oil: 'medium', ghee: 'sometimes', milk: 'toned' };

/**
 * Checks the kitchen settings sent by the app; unknown values fall back to typical ones.
 * @param {any} raw
 * @returns {Kitchen | null}
 */
export function parseKitchen(raw) {
  if (!raw || typeof raw !== 'object') return null;
  /** @type {Kitchen} */
  const kitchen = { ...KITCHEN_DEFAULTS, note: typeof raw.note === 'string' ? raw.note.trim().slice(0, 300) : '' };
  for (const key of KITCHEN_KEYS) {
    if (typeof raw[key] === 'string' && Object.hasOwn(KITCHEN_TEXT[key], raw[key])) kitchen[key] = raw[key];
  }
  return kitchen;
}

/** @param {Kitchen} kitchen */
function describeKitchen(kitchen) {
  const lines = KITCHEN_KEYS.map((key) => KITCHEN_TEXT[key][kitchen[key]]);
  if (kitchen.note) lines.push(`Also: """${kitchen.note}"""`);
  return `About my kitchen, for anything I don't specify:\n${lines.map((l) => `- ${l}`).join('\n')}`;
}

const nullable = (/** @type {string} */ type) => ({ type: [type, 'null'] });

const MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'items', 'confidence', 'note', 'tip', 'basis', 'source_url'],
  properties: {
    title: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'assumption'],
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          grams: nullable('number'),
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          assumption: nullable('string'),
        },
      },
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    note: nullable('string'),
    tip: nullable('string'),
    basis: { type: 'string', enum: ['label', 'web', 'estimate'] },
    source_url: nullable('string'),
  },
};

/**
 * @param {{ text?: string; imageDataUrl?: string; note?: string | null; kitchen?: Kitchen | null }} input
 * @returns {Promise<MealAnalysis>}
 */
export async function analyzeMeal(input) {
  /** @type {import('openai/resources/responses/responses').ResponseInputMessageContentList} */
  const content = input.imageDataUrl
    ? [
        { type: 'input_image', image_url: input.imageDataUrl, detail: 'auto' },
        {
          type: 'input_text',
          text: input.note ? `Estimate the food in this photo. The person adds: """${input.note}"""` : 'Estimate the food in this photo.',
        },
      ]
    : [{ type: 'input_text', text: `What I ate: """${input.text}"""` }];
  if (input.kitchen) content.unshift({ type: 'input_text', text: describeKitchen(input.kitchen) });

  const effort = /** @type {import('openai/resources/shared').ReasoningEffort} */ (reasoningEffort() || null);
  const response = await openai().responses.create({
    model: analysisModel(),
    instructions: INSTRUCTIONS,
    input: [{ role: 'user', content }],
    ...(effort ? { reasoning: { effort } } : {}),
    // The model decides when to search; the instructions limit it to branded products.
    // An empty location stops results defaulting to the United States.
    ...(webSearch()
      ? { tools: [{ type: 'web_search', user_location: { type: 'approximate' } }], include: ['web_search_call.action.sources'] }
      : {}),
    text: { format: { type: 'json_schema', name: 'meal_estimate', schema: MEAL_SCHEMA, strict: true } },
    max_output_tokens: 8000,
    store: false,
  });

  if (response.status !== 'completed' || !response.output_text) {
    throw new Error(`OpenAI returned ${response.status}: ${JSON.stringify(response.incomplete_details)}`);
  }
  return sanitize(JSON.parse(response.output_text), searchedUrls(response));
}

/**
 * Every URL the model's web searches returned, or null when it didn't search.
 * @param {import('openai/resources/responses/responses').Response} response
 * @returns {string[] | null}
 */
function searchedUrls(response) {
  const calls = response.output.filter((item) => item.type === 'web_search_call');
  if (calls.length === 0) return null;
  return calls.flatMap((call) => (call.action?.type === 'search' ? (call.action.sources ?? []).map((s) => s.url) : []));
}

const hostOf = (/** @type {string} */ url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * The model's source link, kept only if it's a web page on a site its searches actually returned.
 * @param {unknown} raw
 * @param {string[]} searched
 */
function sourceUrl(raw, searched) {
  if (typeof raw !== 'string' || !/^https?:\/\//i.test(raw.trim())) return null;
  const url = raw.trim();
  const host = hostOf(url);
  if (!host) return null;
  return searched.length === 0 || searched.some((s) => hostOf(s) === host) ? url.slice(0, 500) : null;
}

/**
 * Clamps and tidies the model's output so the app never stores nonsense values.
 * @param {any} raw
 * @param {string[] | null} [searched] URLs returned by the model's web searches; null when it didn't search
 * @returns {MealAnalysis}
 */
export function sanitize(raw, searched = null) {
  const num = (/** @type {unknown} */ v, /** @type {number} */ max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
  };
  const str = (/** @type {unknown} */ v, /** @type {number} */ max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  /** @type {AnalyzedItem[]} */
  const items = (Array.isArray(raw?.items) ? raw.items : []).slice(0, 20).map((/** @type {any} */ i) => ({
    name: str(i?.name, 60) || 'Food',
    quantity: Math.round(num(i?.quantity, 10_000) * 100) / 100 || 1,
    unit: str(i?.unit, 20) || 'serving',
    grams: i?.grams == null ? null : Math.round(num(i.grams, 10_000)),
    kcal: Math.round(num(i?.kcal, 5_000)),
    protein: Math.round(num(i?.protein, 500)),
    carbs: Math.round(num(i?.carbs, 1_000)),
    fat: Math.round(num(i?.fat, 500)),
    assumption: str(i?.assumption, 160) || null,
  }));

  return {
    title: str(raw?.title, 60) || items.slice(0, 2).map((i) => i.name).join(' & ') || 'Meal',
    items,
    confidence: ['high', 'medium', 'low'].includes(raw?.confidence) ? raw.confidence : 'medium',
    note: str(raw?.note, 240) || null,
    tip: (items.length > 0 && str(raw?.tip, 140)) || null,
    ...basisOf(raw, searched),
  };
}

/**
 * Where the numbers came from. "web" only counts when a search actually ran.
 * @param {any} raw
 * @param {string[] | null} searched
 * @returns {{ basis: Basis; sourceUrl: string | null }}
 */
function basisOf(raw, searched) {
  if (raw?.basis === 'label') return { basis: 'label', sourceUrl: null };
  if (raw?.basis === 'web' && searched) return { basis: 'web', sourceUrl: sourceUrl(raw?.source_url, searched) };
  return { basis: 'estimate', sourceUrl: null };
}
