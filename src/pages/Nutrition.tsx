import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Droplets } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

type DietType = "vegetarian" | "vegan" | "omnivore" | "pescatarian" | "keto";
type HealthGoal = "energy" | "mood" | "weight" | "sleep" | "gut";
type Restriction = "dairy-free" | "gluten-free" | "nut-free" | "low-sugar" | "none";

type NutritionProfile = {
  dietType: DietType;
  goal: HealthGoal;
  restrictions: Restriction[];
};

type Meal = {
  emoji: string;
  name: string;
  note: string;
};

type MealPlan = {
  breakfast: Meal;
  lunch: Meal;
  dinner: Meal;
  snack: Meal;
};

type Tip = {
  emoji: string;
  title: string;
  body: string;
};

// ── Static data ───────────────────────────────────────────────────────────────

const DIET_OPTIONS: { value: DietType; label: string; emoji: string }[] = [
  { value: "vegetarian", label: "Vegetarian", emoji: "🥦" },
  { value: "vegan", label: "Vegan", emoji: "🌱" },
  { value: "omnivore", label: "Omnivore", emoji: "🍗" },
  { value: "pescatarian", label: "Pescatarian", emoji: "🐟" },
  { value: "keto", label: "Keto", emoji: "🥑" },
];

const GOAL_OPTIONS: { value: HealthGoal; label: string; emoji: string }[] = [
  { value: "energy", label: "Boost Energy", emoji: "⚡" },
  { value: "mood", label: "Improve Mood", emoji: "😊" },
  { value: "weight", label: "Manage Weight", emoji: "⚖️" },
  { value: "sleep", label: "Better Sleep", emoji: "🌙" },
  { value: "gut", label: "Gut Health", emoji: "🫀" },
];

const RESTRICTION_OPTIONS: { value: Restriction; label: string }[] = [
  { value: "dairy-free", label: "Dairy-free" },
  { value: "gluten-free", label: "Gluten-free" },
  { value: "nut-free", label: "Nut-free" },
  { value: "low-sugar", label: "Low sugar" },
  { value: "none", label: "No restrictions" },
];

// Simplified meal plan lookup — keyed by dietType + goal
const MEAL_PLANS: Record<DietType, Record<HealthGoal, MealPlan>> = {
  vegetarian: {
    energy: {
      breakfast: { emoji: "🥣", name: "Oats with banana & almond butter", note: "Complex carbs + healthy fats for sustained energy" },
      lunch: { emoji: "🥗", name: "Quinoa Buddha bowl with roasted veggies", note: "Complete protein + iron-rich greens" },
      dinner: { emoji: "🍲", name: "Lentil dal with brown rice", note: "High protein, B-vitamins for energy metabolism" },
      snack: { emoji: "🍌", name: "Banana with a handful of walnuts", note: "Quick glucose + omega-3 for brain energy" },
    },
    mood: {
      breakfast: { emoji: "🫐", name: "Greek yogurt parfait with blueberries", note: "Probiotics support gut-brain axis" },
      lunch: { emoji: "🥬", name: "Spinach & chickpea wrap with tahini", note: "Folate + magnesium — key mood minerals" },
      dinner: { emoji: "🍜", name: "Tofu stir-fry with edamame & soba noodles", note: "Tryptophan-rich tofu supports serotonin" },
      snack: { emoji: "🍫", name: "Small square of dark chocolate + berries", note: "Flavonoids improve mood and cognition" },
    },
    weight: {
      breakfast: { emoji: "🥚", name: "Scrambled eggs with spinach & tomatoes", note: "High protein breakfast reduces hunger hormones" },
      lunch: { emoji: "🥙", name: "Hummus veggie wrap with avocado", note: "Fibre + healthy fats improve satiety" },
      dinner: { emoji: "🍛", name: "Paneer tikka with cauliflower rice", note: "Protein-dense, lower-calorie swap" },
      snack: { emoji: "🥕", name: "Carrot sticks with hummus", note: "Low calorie, high fibre, satisfying crunch" },
    },
    sleep: {
      breakfast: { emoji: "🌾", name: "Whole-grain toast with avocado & seeds", note: "Magnesium & tryptophan prime better sleep" },
      lunch: { emoji: "🫘", name: "Black bean & sweet potato bowl", note: "Complex carbs support melatonin production" },
      dinner: { emoji: "🥛", name: "Warm turmeric milk with oat khichdi", note: "Tryptophan + melatonin-boosting tryptophan combo" },
      snack: { emoji: "🍒", name: "Tart cherries + chamomile tea", note: "Natural melatonin source, calming evening ritual" },
    },
    gut: {
      breakfast: { emoji: "🫙", name: "Kefir smoothie with mixed berries & flax", note: "Probiotic-rich base + prebiotic fibre" },
      lunch: { emoji: "🥗", name: "Kimchi fried rice with edamame", note: "Fermented kimchi feeds good gut bacteria" },
      dinner: { emoji: "🍠", name: "Miso soup with tofu, wakame & sweet potato", note: "Probiotic miso + prebiotic sweet potato" },
      snack: { emoji: "🍎", name: "Apple with a tablespoon of almond butter", note: "Pectin fibre supports microbiome diversity" },
    },
  },
  vegan: {
    energy: {
      breakfast: { emoji: "🌾", name: "Chia pudding with mango & pumpkin seeds", note: "Omega-3 + slow-release carbs for all-morning energy" },
      lunch: { emoji: "🥙", name: "Falafel wrap with tabbouleh & tahini", note: "Plant protein + complex carbs" },
      dinner: { emoji: "🍲", name: "Red lentil soup with whole-grain bread", note: "Iron + B12-fortified bread for sustained vitality" },
      snack: { emoji: "🥜", name: "Trail mix: almonds, cashews, dried apricots", note: "Healthy fats + natural sugars for quick fuel" },
    },
    mood: {
      breakfast: { emoji: "🫐", name: "Açaí bowl with granola & seeds", note: "Antioxidants reduce neuroinflammation" },
      lunch: { emoji: "🥗", name: "Kale, walnut & orange salad with miso dressing", note: "Omega-3 walnuts + vitamin C for dopamine synthesis" },
      dinner: { emoji: "🍛", name: "Tempeh curry with coconut milk & spinach", note: "Fermented tempeh + iron-rich spinach for mood" },
      snack: { emoji: "🍫", name: "Medjool dates with dark chocolate drizzle", note: "Magnesium + natural sugars lift energy and mood" },
    },
    weight: {
      breakfast: { emoji: "🥣", name: "Overnight oats with flax & berries", note: "Beta-glucan fibre keeps you full longer" },
      lunch: { emoji: "🥗", name: "Large green salad with lentils & lemon dressing", note: "Volume eating — satisfying, lower calorie density" },
      dinner: { emoji: "🥦", name: "Stir-fried tofu with broccoli & brown rice", note: "Protein + fibre combination for satiety" },
      snack: { emoji: "🥒", name: "Cucumber & bell pepper with guacamole", note: "High water content, low calorie, nutrient-dense" },
    },
    sleep: {
      breakfast: { emoji: "🫘", name: "Soy milk porridge with banana & nutmeg", note: "Tryptophan-rich soy + sleep-promoting nutmeg" },
      lunch: { emoji: "🍠", name: "Sweet potato & black bean quesadilla (corn tortilla)", note: "Complex carbs + magnesium ease tension" },
      dinner: { emoji: "🌿", name: "Calming chamomile rice bowl with edamame", note: "Edamame GABA content helps ease the nervous system" },
      snack: { emoji: "🫐", name: "Warm berry compote with oat biscuit", note: "Anthocyanins support melatonin regulation" },
    },
    gut: {
      breakfast: { emoji: "🫙", name: "Coconut yogurt with probiotic granola & kiwi", note: "Probiotic base + kiwi's prebiotic inulin" },
      lunch: { emoji: "🌮", name: "Sauerkraut & avocado tacos on corn tortillas", note: "Fermented sauerkraut seeds the gut with lactobacillus" },
      dinner: { emoji: "🍜", name: "Miso ramen with shiitake, nori & tofu", note: "Prebiotic mushrooms + probiotic miso" },
      snack: { emoji: "🍌", name: "Slightly green banana + kombucha", note: "Resistant starch + live cultures for microbiome" },
    },
  },
  omnivore: {
    energy: {
      breakfast: { emoji: "🍳", name: "Eggs, smoked salmon & whole-grain toast", note: "Complete protein + omega-3 for brain energy" },
      lunch: { emoji: "🥗", name: "Grilled chicken quinoa salad with lemon", note: "Lean protein + iron for oxygen transport" },
      dinner: { emoji: "🍗", name: "Baked salmon with roasted sweet potato & greens", note: "CoQ10-rich salmon powers mitochondria" },
      snack: { emoji: "🥚", name: "Hard-boiled egg with a piece of fruit", note: "Protein + natural sugar for sustained alertness" },
    },
    mood: {
      breakfast: { emoji: "🥣", name: "Greek yogurt with walnuts, honey & berries", note: "Probiotics + omega-3 for the gut-brain axis" },
      lunch: { emoji: "🥙", name: "Turkey & avocado wrap with mixed greens", note: "Turkey is one of the highest tryptophan sources" },
      dinner: { emoji: "🍣", name: "Salmon sashimi or teriyaki with edamame rice", note: "EPA/DHA omega-3 are clinically linked to lower depression risk" },
      snack: { emoji: "🍫", name: "Dark chocolate (70%+) with a few almonds", note: "Flavonoids + magnesium elevate serotonin" },
    },
    weight: {
      breakfast: { emoji: "🍳", name: "Veggie omelette (3 eggs, spinach, tomato)", note: "Protein at breakfast reduces total daily calorie intake" },
      lunch: { emoji: "🥗", name: "Big salad with grilled chicken, chickpeas & olive oil", note: "Protein + fibre + healthy fat combo" },
      dinner: { emoji: "🍖", name: "Lean beef stir-fry with broccoli & cauliflower rice", note: "High protein, low calorie density meal" },
      snack: { emoji: "🧀", name: "Cottage cheese with cucumber & cherry tomatoes", note: "Casein protein digests slowly, preventing snacking" },
    },
    sleep: {
      breakfast: { emoji: "🌾", name: "Oatmeal with warm milk, banana & cinnamon", note: "Melatonin precursors from banana + complex carbs" },
      lunch: { emoji: "🍗", name: "Chicken & vegetable soup with barley", note: "Glycine-rich broth improves sleep quality" },
      dinner: { emoji: "🫘", name: "Tryptophan trio: turkey, rice & leafy greens", note: "Classic sleep-promoting amino acid combination" },
      snack: { emoji: "🥛", name: "Warm milk with a pinch of turmeric", note: "Casein + tryptophan + curcumin for restful sleep" },
    },
    gut: {
      breakfast: { emoji: "🫙", name: "Kefir with mixed berries & ground flaxseed", note: "One of the richest probiotic foods available" },
      lunch: { emoji: "🥗", name: "Chicken & fermented vegetable grain bowl", note: "Prebiotic onions/garlic + fermented veg" },
      dinner: { emoji: "🍲", name: "Bone broth soup with leeks, carrots & miso", note: "Collagen supports gut lining; leeks are prebiotic" },
      snack: { emoji: "🍎", name: "Apple with natural peanut butter", note: "Pectin feeds Bifidobacterium in the colon" },
    },
  },
  pescatarian: {
    energy: {
      breakfast: { emoji: "🍳", name: "Smoked salmon scramble on rye toast", note: "Omega-3 + protein for sharp, sustained energy" },
      lunch: { emoji: "🥗", name: "Tuna niçoise salad with boiled eggs", note: "Iron + B12 for oxygen and energy metabolism" },
      dinner: { emoji: "🍣", name: "Grilled mackerel with brown rice & stir-fry veg", note: "EPA/DHA fuel mitochondrial energy production" },
      snack: { emoji: "🥜", name: "Mixed nuts & dried seaweed crisps", note: "Iodine from seaweed supports thyroid/energy" },
    },
    mood: {
      breakfast: { emoji: "🫐", name: "Açaí smoothie bowl with chia & granola", note: "Omega-3 ALA + antioxidants for neuroinflammation" },
      lunch: { emoji: "🌮", name: "Prawn tacos with mango salsa & slaw", note: "Zinc-rich prawns support serotonin synthesis" },
      dinner: { emoji: "🍜", name: "Miso ramen with salmon, mushrooms & nori", note: "Probiotic miso + B12 for nervous system health" },
      snack: { emoji: "🍫", name: "Dark chocolate & walnuts", note: "Omega-3 walnuts + polyphenols improve mood" },
    },
    weight: {
      breakfast: { emoji: "🥚", name: "Poached eggs with smoked salmon & spinach", note: "High protein, nutrient-dense, low calorie" },
      lunch: { emoji: "🥗", name: "Shrimp & avocado salad with quinoa", note: "Lean seafood protein keeps hunger at bay" },
      dinner: { emoji: "🍗", name: "Baked cod with roasted Mediterranean veg", note: "Very lean white fish + fibre-rich vegetables" },
      snack: { emoji: "🥒", name: "Cucumber rounds with smoked salmon", note: "Protein + water content for lasting fullness" },
    },
    sleep: {
      breakfast: { emoji: "🌾", name: "Oatmeal with walnuts, flaxseed & warm milk", note: "Tryptophan + complex carbs prime melatonin later" },
      lunch: { emoji: "🥗", name: "Tuna & leafy green bowl with pumpkin seeds", note: "Magnesium-rich seeds ease muscle tension at night" },
      dinner: { emoji: "🐟", name: "Baked salmon with chamomile rice & broccoli", note: "Vitamin D from salmon supports sleep regulation" },
      snack: { emoji: "🍒", name: "Tart cherry juice with a handful of walnuts", note: "Natural melatonin + omega-3 for restorative sleep" },
    },
    gut: {
      breakfast: { emoji: "🫙", name: "Kefir bowl with sardines on rye (separate)", note: "Kefir probiotics + sardine omega-3 for gut lining" },
      lunch: { emoji: "🍣", name: "Sushi platter with miso soup & edamame", note: "Fermented miso + plant prebiotic fibre" },
      dinner: { emoji: "🍲", name: "Fish & vegetable stew with kimchi on the side", note: "Fermented kimchi + broth supports microbiome" },
      snack: { emoji: "🍌", name: "Banana & probiotic yogurt", note: "Inulin prebiotic + live probiotic cultures" },
    },
  },
  keto: {
    energy: {
      breakfast: { emoji: "🥑", name: "Avocado & bacon omelette with cheese", note: "High-fat ketogenic breakfast sustains energy via ketones" },
      lunch: { emoji: "🥗", name: "Cobb salad: chicken, bacon, egg, avocado", note: "Protein + fat macros for steady ketone energy" },
      dinner: { emoji: "🥩", name: "Ribeye steak with asparagus & butter", note: "Creatine + CoQ10-rich red meat fuels mitochondria" },
      snack: { emoji: "🧀", name: "Cheese cubes with olives & almonds", note: "MCTs in cheese convert to ketones rapidly" },
    },
    mood: {
      breakfast: { emoji: "🍳", name: "Smoked salmon & cream cheese on cucumber", note: "Omega-3 EPA/DHA are the most evidence-based mood nutrients" },
      lunch: { emoji: "🥗", name: "Spinach salad with sardines, walnuts & olive oil", note: "DHA directly incorporated into neuron membranes" },
      dinner: { emoji: "🍗", name: "Herb-roasted chicken thighs with green veg", note: "Tryptophan + B6 support serotonin on a keto diet" },
      snack: { emoji: "🍫", name: "Dark chocolate (90%) with macadamia nuts", note: "Magnesium + polyphenols boost mood-regulating pathways" },
    },
    weight: {
      breakfast: { emoji: "🥚", name: "3-egg omelette with feta, spinach & MCT oil", note: "MCT oil increases metabolic rate & reduces appetite" },
      lunch: { emoji: "🥗", name: "Greek salad with grilled halloumi", note: "Protein + healthy fat, minimal carbs" },
      dinner: { emoji: "🥦", name: "Baked salmon with creamed spinach & cauliflower mash", note: "Keto-friendly, high protein, anti-inflammatory" },
      snack: { emoji: "🥜", name: "Macadamia nuts + celery with almond butter", note: "High-fat, low-carb snack with minimal insulin impact" },
    },
    sleep: {
      breakfast: { emoji: "🥚", name: "Soft-boiled eggs with avocado & seeds", note: "Magnesium from seeds supports GABA (sleep neurotransmitter)" },
      lunch: { emoji: "🥗", name: "Tuna salad with mixed greens & olive oil", note: "Vitamin D + omega-3 regulate sleep-wake cycles" },
      dinner: { emoji: "🍗", name: "Turkey lettuce wraps with avocado & cheese", note: "Turkey tryptophan converts to melatonin; fat slows release" },
      snack: { emoji: "🥛", name: "Warm bone broth with a pinch of magnesium salt", note: "Glycine in broth is shown to improve sleep quality" },
    },
    gut: {
      breakfast: { emoji: "🫙", name: "Full-fat kefir with chia seeds", note: "Rich probiotic base compatible with keto macros" },
      lunch: { emoji: "🥗", name: "Probiotic sauerkraut slaw with grilled chicken", note: "Fermented cabbage feeds Lactobacillus strains" },
      dinner: { emoji: "🍲", name: "Beef bone broth soup with leeks & zucchini noodles", note: "L-glutamine in broth heals gut lining" },
      snack: { emoji: "🧀", name: "Aged cheese (cheddar/gouda) — naturally probiotic", note: "Aged cheeses contain live bacteria beneficial for gut" },
    },
  },
};

const TIPS: Tip[] = [
  {
    emoji: "🐟",
    title: "Omega-3 & Mood",
    body: "EPA and DHA omega-3 fatty acids (found in fatty fish, walnuts, flaxseed) are directly incorporated into neuron membranes. Low levels are associated with higher rates of depression and anxiety.",
  },
  {
    emoji: "🫀",
    title: "Gut–Brain Axis",
    body: "Around 95% of serotonin is produced in the gut. Fermented foods (kefir, yogurt, kimchi, miso) seed your microbiome with beneficial bacteria that signal the brain via the vagus nerve.",
  },
  {
    emoji: "💊",
    title: "Magnesium & Stress",
    body: "Magnesium modulates the HPA axis — your body's stress response system. Foods rich in magnesium (dark leafy greens, seeds, legumes, dark chocolate) help blunt cortisol spikes.",
  },
  {
    emoji: "☕",
    title: "Caffeine & Anxiety",
    body: "Caffeine blocks adenosine receptors and increases cortisol. Limiting to 1–2 cups before noon and avoiding it after 2 PM can meaningfully reduce anxiety and improve sleep quality.",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const STORAGE_PROFILE = "mm_nutrition_profile";
const STORAGE_HYDRATION_PREFIX = "mm_hydration_";
const TOTAL_GLASSES = 8;

function todayKey() {
  return new Date().toISOString().split("T")[0]!;
}

function loadProfile(): NutritionProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_PROFILE);
    return raw ? (JSON.parse(raw) as NutritionProfile) : null;
  } catch {
    return null;
  }
}

function loadHydration(): number {
  try {
    return parseInt(localStorage.getItem(`${STORAGE_HYDRATION_PREFIX}${todayKey()}`) ?? "0", 10);
  } catch {
    return 0;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Nutrition() {
  const navigate = useNavigate();

  // Profile + assessment
  const [profile, setProfile] = useState<NutritionProfile | null>(loadProfile);
  const [draftDiet, setDraftDiet] = useState<DietType>("vegetarian");
  const [draftGoal, setDraftGoal] = useState<HealthGoal>("energy");
  const [draftRestrictions, setDraftRestrictions] = useState<Restriction[]>([]);
  const [profileSaved, setProfileSaved] = useState(false);

  // Hydration
  const [glasses, setGlasses] = useState(loadHydration);

  // Tips carousel — single selected index
  const [activeTip, setActiveTip] = useState(0);

  function toggleRestriction(value: Restriction) {
    if (value === "none") {
      setDraftRestrictions(["none"]);
      return;
    }
    setDraftRestrictions((prev) => {
      const without = prev.filter((r) => r !== "none");
      return without.includes(value)
        ? without.filter((r) => r !== value)
        : [...without, value];
    });
  }

  function saveProfile() {
    const p: NutritionProfile = { dietType: draftDiet, goal: draftGoal, restrictions: draftRestrictions };
    localStorage.setItem(STORAGE_PROFILE, JSON.stringify(p));
    setProfile(p);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  function tapGlass(idx: number) {
    const next = idx < glasses ? idx : idx + 1;
    const clamped = Math.min(next, TOTAL_GLASSES);
    setGlasses(clamped);
    localStorage.setItem(`${STORAGE_HYDRATION_PREFIX}${todayKey()}`, String(clamped));
  }

  const mealPlan: MealPlan | null = profile
    ? (MEAL_PLANS[profile.dietType]?.[profile.goal] ?? null)
    : null;

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-transform hover:scale-105 active:scale-95"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <h1 className="text-[17px] font-semibold">Nutrition</h1>
          <p className="text-xs text-muted-foreground">Diet & wellness counselling</p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-300">
          <Droplets className="h-3.5 w-3.5" />
          {glasses}/{TOTAL_GLASSES}
        </div>
      </header>

      <main className="w-full px-4 py-6 space-y-6">

        {/* ── Assessment (shown until profile saved) ── */}
        <AnimatePresence mode="wait">
          {!profile ? (
            <motion.section
              key="assessment"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-[24px] bg-green-50 dark:bg-green-500/10 p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)] space-y-5"
            >
              <div>
                <span className="inline-block rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-0.5 text-xs font-semibold text-green-700 dark:text-green-300">
                  Nutrition
                </span>
                <h2 className="mt-3 text-xl font-bold">Let's personalise your plan</h2>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  Answer 3 quick questions and we'll build a daily meal plan that fits your lifestyle and mental health goals.
                </p>
              </div>

              {/* Diet type */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dietary preference</p>
                <div className="flex flex-wrap gap-2">
                  {DIET_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDraftDiet(opt.value)}
                      className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                        draftDiet === opt.value
                          ? "bg-green-600 text-white"
                          : "bg-white dark:bg-white/10 text-foreground shadow-sm hover:bg-green-50 dark:hover:bg-green-500/10"
                      }`}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Health goal */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Primary health goal</p>
                <div className="flex flex-wrap gap-2">
                  {GOAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDraftGoal(opt.value)}
                      className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                        draftGoal === opt.value
                          ? "bg-green-600 text-white"
                          : "bg-white dark:bg-white/10 text-foreground shadow-sm hover:bg-green-50 dark:hover:bg-green-500/10"
                      }`}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Restrictions */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dietary restrictions</p>
                <div className="flex flex-wrap gap-2">
                  {RESTRICTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => toggleRestriction(opt.value)}
                      className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                        draftRestrictions.includes(opt.value)
                          ? "bg-green-600 text-white"
                          : "bg-white dark:bg-white/10 text-foreground shadow-sm hover:bg-green-50 dark:hover:bg-green-500/10"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={saveProfile}
                className="w-full rounded-full bg-green-600 py-3 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                <AnimatePresence mode="wait">
                  {profileSaved ? (
                    <motion.span
                      key="saved"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-center gap-2"
                    >
                      <Check className="h-4 w-4" /> Saved!
                    </motion.span>
                  ) : (
                    <motion.span key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      Build My Meal Plan
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </motion.section>
          ) : (
            /* ── Meal plan (after profile saved) ── */
            <motion.section
              key="mealplan"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Profile pill + reset */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span className="rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-xs font-semibold text-green-700 dark:text-green-300 capitalize">
                    {DIET_OPTIONS.find((d) => d.value === profile.dietType)?.emoji}{" "}
                    {profile.dietType}
                  </span>
                  <span className="rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-xs font-semibold text-green-700 dark:text-green-300 capitalize">
                    {GOAL_OPTIONS.find((g) => g.value === profile.goal)?.emoji}{" "}
                    {GOAL_OPTIONS.find((g) => g.value === profile.goal)?.label}
                  </span>
                </div>
                <button
                  onClick={() => { localStorage.removeItem(STORAGE_PROFILE); setProfile(null); }}
                  className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Edit
                </button>
              </div>

              <h2 className="text-[18px] font-semibold">Today's Meal Plan</h2>

              {mealPlan && (
                <div className="grid grid-cols-2 gap-3">
                  {(["breakfast", "lunch", "dinner", "snack"] as const).map((slot) => {
                    const meal = mealPlan[slot];
                    const labels: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
                    const colors: Record<string, string> = {
                      breakfast: "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/20",
                      lunch: "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20",
                      dinner: "bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20",
                      snack: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20",
                    };
                    return (
                      <div
                        key={slot}
                        className={`rounded-[18px] border p-4 shadow-[0_4px_12px_rgba(15,23,42,0.05)] ${colors[slot]}`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{labels[slot]}</p>
                        <p className="mt-2 text-2xl">{meal.emoji}</p>
                        <p className="mt-1.5 text-sm font-semibold text-foreground leading-snug">{meal.name}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{meal.note}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Hydration Tracker ── */}
        <section className="rounded-[24px] bg-card p-5 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Hydration Tracker</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tap each glass to log it</p>
            </div>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">{glasses}<span className="text-sm font-normal text-muted-foreground">/{TOTAL_GLASSES}</span></span>
          </div>

          <div className="grid grid-cols-8 gap-2">
            {Array.from({ length: TOTAL_GLASSES }, (_, i) => {
              const filled = i < glasses;
              return (
                <button
                  key={i}
                  onClick={() => tapGlass(i)}
                  className="flex flex-col items-center gap-1"
                  aria-label={filled ? "Logged" : "Log glass"}
                >
                  <motion.div
                    animate={{ scale: filled ? [1, 1.15, 1] : 1 }}
                    transition={{ duration: 0.25 }}
                    className={`flex h-9 w-full items-center justify-center rounded-xl text-base transition-colors ${
                      filled
                        ? "bg-green-500 text-white shadow-sm"
                        : "border border-dashed border-border text-muted-foreground"
                    }`}
                  >
                    {filled ? "💧" : "○"}
                  </motion.div>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {glasses === 0
              ? "Hydration supports focus, mood, and energy — start with your first glass."
              : glasses < 4
              ? "You're on your way — aim for at least 4 by midday."
              : glasses < 8
              ? `${8 - glasses} glass${8 - glasses > 1 ? "es" : ""} to go — you're doing great!`
              : "Excellent! You've hit your hydration goal for today. 🎉"}
          </p>
        </section>

        {/* ── Mood–Nutrition Tips ── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Mood & Nutrition Science</h3>

          {/* Tip selector tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TIPS.map((tip, i) => (
              <button
                key={i}
                onClick={() => setActiveTip(i)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150 ${
                  activeTip === i
                    ? "bg-green-600 text-white shadow-md"
                    : "bg-card shadow-[0_2px_8px_rgba(15,23,42,0.06)] text-foreground hover:bg-green-50 dark:hover:bg-green-500/10"
                }`}
              >
                <span>{tip.emoji}</span>
                <span className="truncate max-w-[90px]">{tip.title}</span>
              </button>
            ))}
          </div>

          {/* Active tip card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTip}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              className="rounded-[20px] bg-green-50 dark:bg-green-500/10 p-5 shadow-[0_8px_20px_rgba(15,23,42,0.05)]"
            >
              <p className="text-lg font-bold">{TIPS[activeTip]!.emoji} {TIPS[activeTip]!.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{TIPS[activeTip]!.body}</p>
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Bottom padding */}
        <div className="h-6" />
      </main>
    </div>
  );
}
