import { callAI } from "./ai-provider.js";

const SEED_QUERIES = [
  // WEST AFRICAN FOOD
  "Nigerian Jollof Party Rice","Nigerian Egusi Soup","Nigerian Pepper Soup",
  "Nigerian Suya spiced beef","Nigerian Puff Puff","Nigerian Moi Moi",
  "Nigerian Banga Soup","Nigerian Ofada Rice Ayamase","Nigerian Afang Soup",
  "Nigerian Oha Soup","Nigerian Fried Rice party","Nigerian Ogbono Soup",
  "Nigerian Akara bean fritters","Nigerian Chin Chin","Nigerian Kilishi",
  "Ghanaian Kelewele plantain","Ghanaian Waakye rice beans","Ghanaian Light Soup",
  "Ghanaian Fufu peanut soup","Ghanaian Banku tilapia","Ghanaian Jollof Rice",
  "Ghanaian Red Red bean stew","Ghanaian Bofrot donuts",
  "Senegalese Thieboudienne","Senegalese Yassa chicken","Senegalese Mafe peanut stew",
  "Sierra Leone Groundnut Soup","Cameroonian Ndole bitter leaf",
  "Ivorian Kedjenou chicken","Togolese Akume corn fufu",
  // EAST AFRICAN FOOD
  "Ethiopian Doro Wat","Ethiopian Injera flatbread","Ethiopian Tibs sauteed meat",
  "Ethiopian Shiro chickpea","Ethiopian Kitfo minced beef","Ethiopian Misir red lentils",
  "Kenyan Nyama Choma","Kenyan Ugali","Kenyan Pilau spiced rice",
  "Tanzanian Zanzibar Pilau","Ugandan Rolex egg chapati","Ugandan Matooke stew",
  "Somali Bariis rice","Rwandan Isombe cassava",
  // NORTH AFRICAN FOOD
  "Moroccan Lamb Tagine","Moroccan Chicken Bastilla","Moroccan Couscous",
  "Moroccan Harira soup","Moroccan Zaalouk eggplant","Moroccan Msemen bread",
  "Tunisian Shakshuka","Tunisian Brik pastry","Egyptian Koshari",
  "Egyptian Ful Medames","Egyptian Molokhia","Libyan Sharba soup",
  // SOUTH AFRICAN FOOD
  "South African Bobotie","South African Braai BBQ","South African Bunny Chow",
  "South African Boerewors","South African Malva Pudding","South African Koeksister",
  // ITALIAN FOOD
  "Italian Spaghetti Carbonara","Italian Cacio e Pepe","Italian Risotto Milanese",
  "Italian Osso Buco","Italian Pizza Napoletana","Italian Arancini",
  "Italian Tiramisu","Italian Panna Cotta","Italian Cannoli","Italian Gelato",
  // FRENCH FOOD
  "French Coq au Vin","French Beef Bourguignon","French Bouillabaisse",
  "French Quiche Lorraine","French Croissant","French Crepes Suzette",
  "French Tarte Tatin","French Creme Brulee","French Ratatouille","French Vichyssoise",
  // SPANISH FOOD
  "Spanish Paella Valenciana","Spanish Tortilla Espanola","Spanish Gazpacho",
  "Spanish Patatas Bravas","Spanish Churros","Spanish Albondigas",
  // BRITISH FOOD
  "British Sunday Roast","British Fish and Chips","British Shepherd Pie",
  "British Beef Wellington","British Sticky Toffee Pudding","British Full English Breakfast",
  "British Scotch Eggs","British Bangers and Mash","Irish Beef Guinness Stew",
  "Scottish Haggis","Irish Soda Bread",
  // GERMAN AND CENTRAL EUROPEAN
  "German Sauerbraten","German Bratwurst","German Schnitzel",
  "German Spaetzle","German Black Forest Cake","German Pretzels",
  "Greek Moussaka","Greek Spanakopita","Greek Souvlaki","Greek Gyros",
  "Greek Dolmades","Turkish Kebab","Turkish Baklava","Turkish Manti dumplings",
  "Polish Pierogi","Hungarian Goulash",
  // MIDDLE EASTERN
  "Lebanese Hummus","Lebanese Falafel","Lebanese Tabbouleh","Lebanese Kibbeh",
  "Lebanese Mansaf lamb rice","Israeli Shakshuka","Iranian Ghormeh Sabzi",
  "Iranian Tahdig crispy rice","Saudi Arabian Kabsa",
  // SOUTH ASIAN
  "Indian Butter Chicken","Indian Biryani Hyderabadi","Indian Dal Makhani",
  "Indian Palak Paneer","Indian Chole Bhature","Indian Dosa crispy",
  "Indian Samosa potato","Indian Gulab Jamun","Indian Kheer rice pudding",
  "Pakistani Nihari beef","Pakistani Karahi chicken","Sri Lankan Fish Curry",
  // SOUTHEAST ASIAN
  "Thai Pad Thai","Thai Green Curry","Thai Tom Yum Goong","Thai Massaman Curry",
  "Thai Mango Sticky Rice","Vietnamese Pho Bo","Vietnamese Banh Mi",
  "Vietnamese Spring Rolls","Indonesian Nasi Goreng","Indonesian Rendang",
  "Indonesian Satay","Malaysian Nasi Lemak","Malaysian Laksa",
  "Singaporean Hainanese Chicken Rice","Filipino Adobo","Filipino Sinigang",
  // EAST ASIAN
  "Japanese Tonkotsu Ramen","Japanese Sushi Rolls","Japanese Gyoza",
  "Japanese Teriyaki Chicken","Japanese Tempura","Japanese Miso Soup",
  "Japanese Takoyaki","Japanese Okonomiyaki","Chinese Peking Duck",
  "Chinese Dim Sum","Chinese Kung Pao Chicken","Chinese Mapo Tofu",
  "Chinese Char Siu pork","Chinese Fried Rice Yangzhou","Korean Bibimbap",
  "Korean Kimchi Jjigae","Korean Fried Chicken","Korean Bulgogi",
  "Korean Tteokbokki","Korean Japchae noodles","Korean Samgyeopsal",
  // AMERICAN
  "American Smash Burger","American Southern Fried Chicken","American BBQ Brisket Texas",
  "American Mac and Cheese","American Clam Chowder","American Caesar Salad",
  "American Lobster Roll","American Philly Cheesesteak","American Apple Pie",
  "American New York Cheesecake","American Pancakes Maple Syrup","American Buffalo Wings",
  // LATIN AMERICAN
  "Mexican Birria Tacos","Mexican Guacamole","Mexican Tamales",
  "Mexican Enchiladas","Mexican Pozole","Mexican Tres Leches Cake","Mexican Churros",
  "Brazilian Churrasco BBQ","Brazilian Feijoada","Brazilian Brigadeiro",
  "Brazilian Pao de Queijo","Argentine Asado","Argentine Empanadas",
  "Argentine Chimichurri steak","Peruvian Ceviche","Peruvian Lomo Saltado",
  "Colombian Arepas","Jamaican Jerk Chicken","Jamaican Oxtail stew",
  "Cuban Ropa Vieja","Trinidad Doubles chickpea",
  // HEALTHY AND DIET
  "High Protein Chicken Meal Prep","High Protein Salmon Buddha Bowl",
  "High Protein Quinoa Salad","High Protein Turkey Meatballs",
  "Low Calorie Zucchini Noodles","Low Calorie Cauliflower Rice",
  "Low Calorie Greek Salad","Low Calorie Vegetable Soup",
  "Vegan Buddha Bowl","Vegan Lentil Dal coconut","Vegan Jackfruit Pulled Pork",
  "Vegan Black Bean Burgers","Vegan Chickpea Tikka Masala",
  "Vegetarian Mushroom Risotto","Vegetarian Eggplant Parmigiana",
  "Slim Diet Overnight Oats","Slim Diet Grilled Salmon asparagus",
  "Slim Diet Turkey Lettuce Wrap","Keto Avocado Chicken salad",
  // QUICK MEALS
  "Quick 15 Minute Pasta garlic oil","Quick Egg Fried Rice",
  "Quick Quesadilla chicken cheese","Quick Stir Fry vegetables",
  "Quick Shakshuka eggs tomato","Quick Greek Wrap pita",
  // DESSERTS
  "French Creme Brulee","Italian Tiramisu espresso","American Chocolate Lava Cake",
  "Japanese Mochi ice cream","Turkish Baklava pistachios",
  "Nigerian Chin Chin crunchy","Lebanese Knafeh cheese pastry",
  "Brazilian Brigadeiro chocolate","Mexican Tres Leches",
  // COCKTAILS
  "Classic Mojito rum lime mint","Pina Colada coconut rum",
  "Classic Margarita tequila lime","Aperol Spritz Prosecco",
  "Negroni Campari gin vermouth","Old Fashioned bourbon",
  "Moscow Mule vodka ginger beer","Cosmopolitan vodka cranberry",
  "Espresso Martini coffee vodka","Whiskey Sour lemon egg white",
  "Daiquiri strawberry rum","Bloody Mary vodka tomato",
  "Manhattan rye whiskey","French 75 gin champagne",
  "Caipirinha cachaca lime","Cuba Libre rum cola",
  "Tom Collins gin lemon soda","Tequila Sunrise grenadine",
  "Singapore Sling gin cherry","Dark and Stormy rum ginger",
  "Paloma tequila grapefruit","Bramble gin blackberry",
  "Amaretto Sour amaretto lemon","Long Island Iced Tea",
  // AFRICAN DRINKS
  "Nigerian Chapman cocktail","Nigerian Zobo hibiscus drink",
  "Nigerian Palm Wine fermented","Nigerian Kunu millet drink",
  "Nigerian Tiger Nut Milk","Ghanaian Sobolo hibiscus",
  "Senegalese Bissap Baobab","Kenyan Dawa cocktail",
  "Ethiopian Tej honey wine","Ethiopian Buna coffee ceremony",
  "South African Amarula cocktail","South African Rooibos iced tea",
  "Moroccan Mint Tea traditional","Egyptian Karkade hibiscus",
  "West African Ginger Beer homemade",
  // HEALTHY DRINKS
  "Green Detox Smoothie spinach apple","Watermelon Mint Cooler",
  "Mango Turmeric Smoothie","Banana Protein Shake peanut butter",
  "Matcha Latte oat milk","Golden Milk Turmeric Latte",
  "Beet Ginger Immunity Juice","Carrot Orange Ginger Juice",
  "Cucumber Mint Water detox","Lemon Ginger Honey Hot drink",
  "Celery Juice Morning Cleanse","Kombucha Ginger homemade",
  "Kefir Berry Probiotic Smoothie","Green Tea Honey Lemon",
  // WORLD DRINKS
  "Indian Mango Lassi yogurt","Indian Masala Chai spiced tea",
  "Thai Iced Tea condensed milk","Vietnamese Egg Coffee Hanoi",
  "Korean Dalgona Coffee whipped","Japanese Matcha Latte ceremonial",
  "Mexican Horchata rice milk cinnamon","Mexican Tamarind Agua Fresca",
  "Colombian Chocolate Caliente","Peruvian Chicha Morada purple corn",
  "Turkish Ayran salted yogurt","Lebanese Jallab grape rosewater",
  "Moroccan Orange Blossom Lemonade","German Gluehwein hot spiced wine",
  "British Earl Grey Tea","Italian Espresso classic",
  "Greek Frappe iced coffee","Swedish Glogg mulled wine",
  // SMOOTHIES
  "Tropical Pineapple Coconut Smoothie","Strawberry Banana Smoothie",
  "Blueberry Acai Bowl","Papaya Lime Digestive Smoothie",
  "Mixed Berry Protein Smoothie","Avocado Cocoa Smoothie",
  "Mango Coconut Tropical Shake","Vanilla Almond Milk Shake",
];

const slugify = q => q.toLowerCase().trim()
  .replace(/[^a-z0-9\s-]/g,"").replace(/\s+/g,"-").slice(0,80);

const DRINK_KEYS = ["cocktail","drink","smoothie","juice","tea","latte","coffee","beer","wine","water","shot","bissap","sobolo","zobo","chapman","lassi","chai","kvass","mate","agua","horchata","chicha","kefir","kombucha","ayran","jallab","frappe","espresso","mojito","margarita","pina","negroni","daiquiri","manhattan","gimlet","paloma","caipirinha","aperol","glogg","gluehwein"];
const isDrink = q => DRINK_KEYS.some(k => q.toLowerCase().includes(k));

function toFV(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return { integerValue: String(Math.round(val)) };
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFV) } };
  if (typeof val === "object") {
    const fields = {};
    for (const [k,v] of Object.entries(val)) fields[k] = toFV(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({
      total: SEED_QUERIES.length,
      food: SEED_QUERIES.filter(q => !isDrink(q)).length,
      drinks: SEED_QUERIES.filter(q => isDrink(q)).length,
      message: "POST with {secret, startIndex, batchSize} to seed"
    });
  }

  const { secret, startIndex=0, batchSize=3 } = req.body||{};
  if (secret !== process.env.SEED_SECRET) return res.status(401).json({ error:"Unauthorized" });

  const projectId = process.env.FIREBASE_PROJECT_ID||"mama-k-recipies";
  const pexelsKey = process.env.PEXELS_API_KEY;
  const batch = SEED_QUERIES.slice(Number(startIndex), Number(startIndex)+Number(batchSize));
  if (!batch.length) return res.status(200).json({ done:true, total:SEED_QUERIES.length });

  const results = [];
  for (const query of batch) {
    try {
      const drink = isDrink(query);
      const prompt = drink
        ? `Beverages expert. Return ONLY valid JSON array of 2 drink recipes for: "${query}". Each: {"title":string,"emoji":emoji,"tagline":max 8 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"cuisine":string,"region":string,"tags":[2 strings],"ingredients":[4-8 strings],"steps":[3-5 strings],"type":"drink"}. ONLY raw JSON array.`
        : `Culinary database. Return ONLY valid JSON array of 2 recipes for: "${query}". Each: {"title":string,"emoji":emoji,"tagline":max 8 words,"time":string,"difficulty":"Easy"|"Medium"|"Advanced","servings":number,"calories":number,"cuisine":string,"region":string,"tags":[2 strings],"ingredients":[6-10 strings],"steps":[4-6 strings],"type":"food"}. ONLY raw JSON array.`;

      const text = await callAI(prompt, 700);
      let recipes;
      try { recipes = JSON.parse(text.replace(/^```json\s*/i,"").replace(/```\s*$/i,"").trim()); if (!Array.isArray(recipes)) continue; }
      catch { results.push({ query, error:"parse failed" }); continue; }

      for (let i=0; i<recipes.length; i++) {
        try {
          const q = encodeURIComponent(`${recipes[i].title} ${drink?"drink beverage glass":"food dish plated"}`);
          const pRes = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=1&orientation=landscape`,{ headers:{ Authorization:pexelsKey } });
          const pData = await pRes.json();
          const photo = pData?.photos?.[0];
          if (photo) recipes[i] = { ...recipes[i], imageSmall:photo.src.tiny, image:photo.src.medium, imageLarge:photo.src.large2x, photographer:photo.photographer };
        } catch {}
      }

      const key = slugify(query)+"__free";
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/recipes/${key}`;
      await fetch(url,{
        method:"PATCH", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ fields:{ query:{stringValue:query.toLowerCase().trim()}, slugKey:{stringValue:slugify(query)}, type:{stringValue:drink?"drink":"food"}, seeded:{booleanValue:true}, searchCount:{integerValue:"0"}, recipes:toFV(recipes) } })
      });
      results.push({ query, count:recipes.length, type:drink?"drink":"food" });
    } catch(err) { results.push({ query, error:err.message }); }
  }

  const nextIndex = Number(startIndex)+Number(batchSize);
  return res.status(200).json({
    seeded: results,
    nextIndex,
    total: SEED_QUERIES.length,
    remaining: Math.max(0, SEED_QUERIES.length-nextIndex),
    progress: `${Math.round((nextIndex/SEED_QUERIES.length)*100)}%`,
    done: nextIndex >= SEED_QUERIES.length,
  });
}
