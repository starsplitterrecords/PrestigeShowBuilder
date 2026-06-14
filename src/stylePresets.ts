export interface StylePreset {
  name: string;
  register: string; // 3-word descriptor shown in the button
  category: 'live-action' | 'comics' | 'animation';
  pos: string;
  neg: string;
  composition?: string;  // Optional staging/layout instruction, independent of visual style
}

export const STYLE_PRESETS: StylePreset[] = [
  // --- COMICS ---
  {
    name: 'Maleev',
    register: 'Urban Noir',
    category: 'comics',
    pos:
      'painted comic book art, desaturated urban palette, ' +
      'photorealistic face structure rendered in thick painterly brushwork, ' +
      'single warm practical light source cutting against deep shadow, ' +
      'partially obscured figures, surveillance-angle low framing, ' +
      'rough canvas texture visible beneath paint layers, ' +
      'muted browns and grays with isolated amber accent, ' +
      'heavy ink shadow masses, loosely-rendered impressionistic backgrounds, ' +
      'emotional realism, cinematic noir composition, ' +
      'painted illustration not digital, no clean lines, no bright colors',
    neg:
      'bright colors, clean digital lines, cel shading, anime, cartoon, ' +
      'gradient fills, flat color, superhero action pose, busy composition, ' +
      'multiple light sources, cheerful, vibrant, saturated, sharp outlines',
  },
  {
    name: 'Bennett',
    register: 'Clean Line',
    category: 'comics',
    pos:
      'professional comic book art, precise ink linework with strong outline weight, ' +
      'fine interior detail lines, anatomically grounded heroic figures, ' +
      'highly expressive readable faces, bold saturated color with clean shadow shapes, ' +
      'clear figure-ground separation, dynamic staging, ' +
      'mainstream American superhero comic aesthetic, ' +
      'readable at thumbnail scale, confident confident inking, ' +
      'no texture noise, no painterly marks',
    neg:
      'painterly, scratchy, rough texture, desaturated, photo-real, ' +
      'impressionistic, blurry, muddy colors, weak linework, ' +
      'anime, cel shading, flat illustration, digital gradients',
  },
  {
    name: 'Ribic',
    register: 'Painted Epic',
    category: 'comics',
    pos:
      'fully painted comic book illustration, oil painting technique, ' +
      'no visible linework, figures modeled entirely in light and shadow, ' +
      'massive environmental scale with small human figures, ' +
      'weathered textured faces with emotional depth, ' +
      'rich muted palette — aged gold, deep burgundy, slate gray, ' +
      'old masters painterly approach, mythic cinematic composition, ' +
      'each panel functions as standalone fine art',
    neg:
      'linework, ink outlines, cel shading, clean digital, anime, ' +
      'bright saturated colors, flat illustration, cartoon, ' +
      'cluttered composition, text-heavy',
  },
  {
    name: 'Steranko',
    register: 'Op-Art Psychedelic',
    category: 'comics',
    pos:
      'bold geometric op-art patterns in comic book format, ' +
      'spy thriller graphic design aesthetic, ' +
      'high contrast black and white with single flat accent color, ' +
      'experimental panel layouts breaking the grid, ' +
      'graphic design influence on sequential art, ' +
      '1960s modernist composition, psychedelic geometric backgrounds, ' +
      'dynamic figure silhouettes against pattern fields',
    neg:
      'realistic, painterly, messy, cluttered, anime, digital clean, ' +
      'multiple colors, photographic, conventional panel layout',
  },
  {
    name: 'Sienkiewicz',
    register: 'Experimental',
    category: 'comics',
    pos:
      'experimental mixed-media comic art, expressionistic paint strokes, ' +
      'visible collage and texture elements, raw gestural marks, ' +
      'psychologically distorted figures, acrylic and ink texture combined, ' +
      'emotionally raw illustration, abstract background elements, ' +
      'paint bleeds and drips, torn paper texture, ' +
      'horror and psychological unease through mark-making',
    neg:
      'clean linework, cute, anime, digital clean, flat, commercial, ' +
      'cheerful, precise, photorealistic, polished',
  },
  {
    name: 'Moebius',
    register: 'Euro Clear Line',
    category: 'comics',
    pos:
      'European ligne claire comic art tradition, ' +
      'precise even linework with no line weight variation, ' +
      'flat color areas with no gradients or shadows, ' +
      'highly detailed alien architecture and vast open landscapes, ' +
      'science fiction surrealism, deserted environments, ' +
      'graphic novel clarity, clean separation between figure and ground, ' +
      'every element outlined with the same weight line',
    neg:
      'painterly, sketch, rough, heavy shadow, superhero, ' +
      'American comics style, dark, moody, expressive brushwork',
  },
  {
    name: 'Frazetta',
    register: 'Heroic Fantasy',
    category: 'comics',
    pos:
      'painted pulp fantasy illustration, dynamic heroic figures in motion, ' +
      'dramatic action poses with anatomical power, ' +
      'warm golden and earth tone palette, painted musculature, ' +
      'atmospheric fog and darkness framing the subject, ' +
      'vintage pulp magazine cover composition, ' +
      'savage beauty, figures emerging from darkness',
    neg:
      'clean digital, anime, superhero tights, modern style, ' +
      'flat color, pastel, cartoonish, static pose',
  },
  {
    name: 'Ross',
    register: 'Painted Realism',
    category: 'comics',
    pos:
      'photorealistic oil painting comic illustration, ' +
      'hyper-detailed human anatomy grounded in real body proportions, ' +
      'classical portraiture lighting — single warm source with deep cool shadow, ' +
      'rich saturated color with glazed depth, no visible linework, ' +
      'heroic figures with physical weight and gravitas, ' +
      'lived-in fabric texture, realistic skin, ' +
      'figures feel like photographs of real people, ' +
      'dramatic staged composition, museum-quality painted illustration',
    neg:
      'linework, ink outlines, cel shading, anime, cartoon, flat color, ' +
      'sketchy, rough, digital clean, gradient mesh, abstract, ' +
      'impressionistic, exaggerated anatomy',
  },
  {
    name: 'Cosmic Manga',
    register: 'God-Scale Epic',
    category: 'comics',
    pos:
      'cosmic superhero comic art, extreme detail density filling every inch of frame, ' +
      'six distinct depth planes simultaneously readable, ' +
      'god-scale central figure dwarfing silhouetted human figures at base for scale contrast, ' +
      'planetary and cosmic object staging — figure holds or commands worlds, ' +
      'stone-crack texture on figure body reading as both geological and mechanical, ' +
      'cyan electric energy light from below, warm orange debris light from sides, cold starfield behind, ' +
      'electricity rendered as simultaneous beam and crackle, ' +
      'obsessive fine hatching and cross-hatching on all surfaces, ' +
      'orbital ring constructs, debris fields, planetary fragments as compositional elements, ' +
      'white birds or small organic life as tonal contrast against destruction, ' +
      'American superhero musculature with manga speed-line energy effects',
    neg:
      'simple background, flat color, minimal detail, single figure only, ' +
      'intimate scale, indoor setting, realistic proportions, ' +
      'painterly, impressionistic, loose linework, pastel, soft lighting, ' +
      'slice of life, mundane, low energy',
  },
  {
    name: '90s Cover',
    register: 'Kinetic Blast',
    category: 'comics',
    pos:
      'mid-1990s American superhero cover art aesthetic, ' +
      'single power figure dead center charging toward viewer, ' +
      'extreme forward foreshortening with readable clean anatomy, ' +
      'radial speed line burst behind figure — all lines converging inward to subject, ' +
      'debris field and rock fragments orbiting figure for kinetic energy, ' +
      'three depth planes maximum: figure foreground, debris mid, radial burst background, ' +
      'manga-inflected gravity-defiant flame hair on Western superhero anatomy, ' +
      'energy blasts at both fists, white-blue shockwave burst, ' +
      'flat color with gradient — gold to orange to red palette, ' +
      'deep black costume with colored accent lines, ' +
      'heavy deliberate linework, each line doing one job, no obsessive cross-hatching',
    neg:
      'multiple figures, team shot, complex background, six depth planes, ' +
      'painterly, impressionistic, soft lighting, muted palette, ' +
      'realistic proportions, grounded, static pose, seated, ' +
      'cosmic god-scale, silhouette figures, text, title, logo, letters',
  },
  {
    name: 'Aja',
    register: 'Grid Architecture',
    category: 'comics',
    pos:
      'strict grid panel architecture comic art, ' +
      'graphic design principles applied to sequential storytelling, ' +
      'icon and symbol integration within panels, ' +
      'limited color palette with one strategic accent color, ' +
      'typographic and diagrammatic elements within composition, ' +
      'negative space used as active storytelling device, ' +
      'sequence and rhythm over individual panel drama',
    neg:
      'busy, highly detailed, painterly, action-heavy, anime, ' +
      'realistic, crowded, multiple colors, expressive brushwork',
  },

  // --- LIVE-ACTION ---
  {
    name: 'Prestige Noir',
    register: 'Cinematic Hyperreal',
    category: 'live-action',
    pos:
      'cinematic hyperrealism, prestige cable drama aesthetic, ' +
      'impossible-but-coherent dual lighting — warm amber practical from below, cool blue-violet city glow from behind, ' +
      'grimy amber and deep teal accent palette over desaturated base, ' +
      'hyperreal surface texture — fabric grain, skin pores, wet hair, ceramic glaze, paper edges simultaneously detailed, ' +
      'selective narrative depth of field — foreground objects sharp, faces sharp, background bokeh, ' +
      'looks like a still from a prestige film that does not exist yet, ' +
      'The Last of Us production design, Dark color grading, early Euphoria cinematography, ' +
      'photographic but beyond what photography can capture — too perfectly composed, too much simultaneous detail',
    neg:
      'flat lighting, clean studio, bright key light, cheerful palette, ' +
      'soft focus throughout, shallow concept art, illustration style, ' +
      'oversaturated, comic book, animated, painterly, impressionistic, ' +
      'generic cinematic, action movie color grade, Marvel palette'
  },
  {
    name: 'Ensemble Tableau',
    register: 'Social Geometry',
    category: 'live-action',
    pos: 'ensemble character shot, multiple figures, shared environment, cinematic staging',
    neg:
      'single figure, isolated portrait, white background, studio shot, ' +
      'figures facing camera directly, symmetrical arrangement, posed group photo',
    composition:
      'Three figures with deliberate social geometry: one leaning forward engaged with work (left), ' +
      'one dominant and watchful at center, one withdrawn and inward-facing (right). ' +
      'Cluttered research table in foreground — papers, notebooks, mugs, devices — lit from below by warm practical light. ' +
      'World-building backdrop: conspiracy wall, evidence board, or dense pinned documents covering the wall behind. ' +
      'City or exterior view visible through window providing cool backlight. ' +
      'Each figure occupies a distinct social position readable at a glance. ' +
      'Foreground clutter tells the story of obsessive work. No figure looks directly at camera.'
  },
  { 
    name: 'Prestige Drama', 
    register: 'Cinematic Masterwork',
    category: 'live-action',
    pos: 'cinematic, masterwork, 8k, detailed textures, soft volumetric lighting, shot on 35mm, anamorphic lenses, high dynamic range, deep shadows',
    neg: 'cartoon, animation, low quality, text, watermark, blurry, extra fingers, poor lighting, flat textures'
  },
  { 
    name: 'Blockbuster Epic', 
    register: 'High Budget Scale',
    category: 'live-action',
    pos: 'high budget superhero aesthetic, saturated colors, anamorphic lens flares, massive scale, detailed CGI elements, high contrast, vibrant grading, epic composition',
    neg: 'indie film, shaky cam, grainy, desaturated, boring, realistic, mundane'
  },
  { 
    name: 'Netflix Period Piece', 
    register: 'Historical Opulence',
    category: 'live-action',
    pos: 'historical drama, opulent textures, rich fabrics, warm candlelit glow, soft focus backgrounds, classical composition, expensive production design, painterly lighting',
    neg: 'modern, digital, cold, industrial, futuristic, tech, minimal'
  },
  { 
    name: 'Mockumentary', 
    register: 'Handheld Reality',
    category: 'live-action',
    pos: 'scripted reality style, handheld camera, snap zooms, natural fluorescent lighting, documentary aesthetic, slightly overexposed, mundane office/domestic textures',
    neg: 'stable camera, cinematic lighting, dramatic shadows, epic, stylized, polished'
  },
  { 
    name: 'Cyberpunk Noir', 
    register: 'Neon Gritty Tech',
    category: 'live-action',
    pos: 'rain-slicked streets, neon reflections, high contrast, cinematic chiaroscuro, lens flares, gritty textures, blade runner aesthetic, tech-noir',
    neg: 'daylight, bright, colorful, clean, friendly, natural'
  },
  { 
    name: 'Scandi-Noir', 
    register: 'Cold Minimalist Grit',
    category: 'live-action',
    pos: 'cold desaturated blue tones, misty moody landscapes, minimalist interior design, oppressive atmosphere, gritty realism, sharp sharp digital textures',
    neg: 'warm, tropical, sunny, happy, saturated, vibrant'
  },
  { 
    name: 'Sketch Comedy', 
    register: 'Bright Studio Setup',
    category: 'live-action',
    pos: 'bright high-key studio lighting, vibrant stage-like setups, clean digital look, multi-cam sitcom aesthetic, clear focus, saturated colors',
    neg: 'moody, cinematic, dark, gritty, film grain, artistic'
  },
  { 
    name: 'Surrealist Indie', 
    register: 'A24 Uncanny Vibe',
    category: 'live-action',
    pos: 'A24 aesthetic, liminal spaces, uncanny symmetry, elevated horror textures, unsettling lighting, grainy 16mm film stock, unique color blocking',
    neg: 'generic, blockbuster, bright, clean, stable, commercial'
  },
  { 
    name: 'Technicolor Retro', 
    register: 'Vivid 1950s Hollywood',
    category: 'live-action',
    pos: 'vivid 1950s technicolor, hyper-saturated reds and greens, painted backdrops, nostalgic glow, classic hollywood film grain, theatrical lighting',
    neg: 'modern, muted, gritty, realistic, digital noise'
  },
  { 
    name: 'Found Footage', 
    register: 'Raw Lo-Fi Cam',
    category: 'live-action',
    pos: 'low-fi, shaky cam, digital noise, surveillance aesthetic, realistic glitches, high iso, raw footage, documentary style',
    neg: 'cinematic lighting, stable camera, clean, sharp, polished'
  },

  // --- ANIMATION ---
  { 
    name: 'Adult Animation', 
    register: 'Modern 2D Sitcom',
    category: 'animation',
    pos: 'vibrant 2d animation, clean thick outlines, flat cel shading, expressive character designs, sharp color palettes, modern animated sitcom aesthetic',
    neg: '3d render, realistic, photographic, blurry, grainy, oil painting'
  },
  { 
    name: 'Anime Aesthetic', 
    register: 'Japanese Cinematic 2D',
    category: 'animation',
    pos: 'japanese animation style, ethereal lighting, emotional speed lines, detailed background art, vibrant highlights, cinematic anime framing',
    neg: '3d, realistic, western cartoon, flat, boring'
  }
];
