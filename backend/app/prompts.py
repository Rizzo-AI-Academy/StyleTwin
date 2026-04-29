"""Prompt library for StyleTwin generation pipeline.

The portrait is sent directly to gpt-image-2 as identity reference together with the prompt.
The model itself derives the color analysis and produces the final styling image.
"""

_BASE_IDENTITY_LOCK = (
    "Using the uploaded portrait as the identity reference, preserve the person's identity, "
    "facial features, face shape, skin tone, expression, and natural proportions. "
    "Do not alter the face, eyes, nose, lips, jawline, or body shape."
)


FULL_REPORT_PROMPT = (
    _BASE_IDENTITY_LOCK
    + """ Only modify hairstyle, clothing, colors, accessories, background, and graphic layout.

Create a clean high-end fashion styling infographic that includes:

1. The original portrait
2. A personalized color analysis section
3. A seasonal color profile
4. Color swatches with short labels
5. Hairstyle recommendations
6. Outfit suggestions
7. Accessory suggestions
8. A final key styling takeaway

The visual should feel like a luxury fashion magazine personal styling report.

Layout:
- Dark neutral or warm beige background
- Elegant editorial typography
- Clean grid structure
- Premium spacing
- Minimalist cards
- Color swatches
- Short labels only
- No long paragraphs

Include these sections:

COLOR ANALYSIS — skin tone, undertone, hair color, eye color (if visible), contrast level, seasonal color profile.

COLOR PALETTE — labeled swatches: best neutrals, best blues and teals, best greens, best reds and pinks, best earth tones, accent colors, metallics, use carefully.

HAIRSTYLE — 4 realistic hairstyle options: natural upgrade, soft volume, sharp and structured, bold transformation.

OUTFITS — 4 wearable outfit concepts: everyday casual, smart casual, elegant evening, signature look.

ACCESSORIES — jewelry metal, glasses frame, watch or bracelet, bag style, necklace style.

FINAL TIP — one short styling takeaway.

Make the image visual-first, polished, modern, realistic, and wearable.
Avoid paragraphs. Use short labels only.
"""
)


COLOR_ANALYSIS_PROMPT = (
    _BASE_IDENTITY_LOCK
    + """ Only adjust styling, clothing color, background, and graphic layout.

Create a clean fashion-editorial color analysis chart with the portrait as the central element.

Include:
1. Main portrait — clear, face realistic and unchanged, elegant studio lighting, top color complementing the recommended palette.
2. Natural coloring — short labels: skin tone, undertone, hair color, eye color (if visible), contrast level.
3. Seasonal color profile — assign and display ONE seasonal profile from:
   Light Spring, Warm Spring, Bright Spring, Light Summer, Cool Summer, Soft Summer,
   Warm Autumn, Soft Autumn, Deep Autumn, Cool Winter, Deep Winter, Bright Winter.
4. Color swatches — best neutrals, greens, blues & teals, reds & pinks, earth tones, accent colors, metallics, use carefully.
5. Color comparison — side-by-side fabric or clothing color comparisons:
   best color near face vs less flattering color near face, best neutral vs weak neutral, best accent vs overpowering accent.

Design: premium fashion magazine, minimalist infographic, dark neutral or warm beige background,
elegant typography, clean grid, short labels with color names, no long paragraphs,
high-end personal stylist aesthetic.
"""
)


HAIRSTYLE_WOMAN_PROMPT = (
    _BASE_IDENTITY_LOCK
    + """ Only change hairstyle, hair length, hair shape, hair texture, hair volume, and optional hair color.

Create 5 realistic hairstyle variations of the same woman:
1. Soft face-framing layers
2. Long layered volume
3. Shoulder-length cut
4. Sleek bob or lob
5. Best overall look (highlight with a subtle "Best match" badge)

For each option include: short hairstyle name, suitability score out of 10, one short reason (max 4 words).

Design: premium salon styling board, side-by-side comparison cards, warm neutral or dark background,
clean editorial typography, soft beauty lighting, short labels only, no paragraphs,
high-end beauty consultation aesthetic.
"""
)


HAIRSTYLE_MAN_PROMPT = (
    _BASE_IDENTITY_LOCK
    + """ Only change hairstyle, hair length, hair texture, hair volume, grooming details, and optional hair color.

Create 5 realistic hairstyle variations of the same man:
1. Textured crop
2. Classic side part
3. Medium flow
4. Short fade with volume
5. Best overall look (highlight with a subtle "Best match" badge)

For each option include: short hairstyle name, suitability score out of 10, one short reason (max 4 words).

Design: premium barbershop styling board, side-by-side comparison cards, dark neutral background,
clean elegant typography, subtle lighting, short labels only, no paragraphs,
high-end grooming guide aesthetic.
"""
)


OUTFIT_WOMAN_PROMPT = (
    _BASE_IDENTITY_LOCK
    + """ Only modify outfit, colors, accessories, pose, background, and layout.

Create 5 realistic outfit mockups of the same woman wearing flattering colors and modern wearable clothing:
1. Everyday casual — top or knitwear, jeans or tailored trousers, casual shoes, simple accessories.
2. Smart casual — blouse, shirt, or knitwear, tailored trousers or skirt, refined shoes.
3. Elegant evening — dress or coordinated set, elevated accessories, flattering palette.
4. Business refined — blazer, blouse or top, trousers or skirt, structured bag.
5. Signature look — the most flattering complete outfit.

For each outfit card include: outfit name, main colors, key clothing pieces, shoes, accessories, one short reason.
Where appropriate add: earrings, necklace, bracelet, watch, bag, glasses, hair accessory.

Design: premium women's fashion styling guide, editorial layout, side-by-side cards,
warm neutral or dark background, clean typography, realistic wearable outfits, short labels only.
"""
)


OUTFIT_MAN_PROMPT = (
    _BASE_IDENTITY_LOCK
    + """ Only modify outfit, colors, accessories, pose, background, and layout.

Create 5 realistic outfit mockups of the same man:
1. Everyday casual — knitwear or T-shirt, jeans or chinos, clean sneakers.
2. Smart casual — shirt or polo, tailored trousers, loafers or clean sneakers.
3. Business refined — blazer, shirt, tailored trousers, leather shoes.
4. Date night — darker flattering palette, elevated jacket, refined accessories.
5. Signature look — the most flattering complete outfit.

For each outfit include: outfit name, main colors, clothing pieces, shoes, accessories, one short reason.
Where appropriate add: watch, belt, glasses, bracelet, bag.

Design: premium men's fashion styling guide, editorial layout, side-by-side cards,
neutral or dark background, clean typography, realistic wearable outfits, short labels only.
"""
)


ACCESSORIES_PROMPT = (
    _BASE_IDENTITY_LOCK
    + """ Only modify accessories, clothing color, background, and layout.

Create a clean visual accessories guide around the person's portrait.

Include:
1. Jewelry metal — gold, silver, rose gold, bronze. Show the best choice visually.
2. Glasses — 3 flattering frame options (soft rounded, angular, minimal thin frame). Highlight the best match.
3. Necklaces — 3 options (fine chain, medium chain, pendant necklace). Highlight the best match.
4. Watches and bracelets — best watch metal, best strap color, best bracelet style.
5. Bags — best bag shape, best bag color, best material impression.
6. Final accessory formula — one short takeaway: "Best accessories: [metal] + [shape] + [color family]".

Design: premium fashion accessories chart, portrait centered, product-style accessory cards around,
clean neutral background, elegant typography, short labels only, no paragraphs.
"""
)


BEFORE_AFTER_PROMPT = (
    _BASE_IDENTITY_LOCK
    + """ Create a realistic before-and-after personal style transformation.

Side-by-side image:
LEFT — Original look. Use the uploaded portrait as close as possible. Label: "Before".
RIGHT — Recommended style. Apply the most flattering hairstyle, the best clothing color near the face,
suitable accessories; improve styling, lighting, and grooming; keep everything realistic and wearable.
Label: "After".

Around the After side add small labels: best color, best hairstyle, best accessory, style direction.

Design: premium fashion makeover, clean editorial layout, neutral or dark background,
elegant typography, realistic transformation, no exaggerated beautification, short labels only.
"""
)


PROMPT_BY_REPORT = {
    "full_report": FULL_REPORT_PROMPT,
    "color_analysis": COLOR_ANALYSIS_PROMPT,
    "hairstyle_woman": HAIRSTYLE_WOMAN_PROMPT,
    "hairstyle_man": HAIRSTYLE_MAN_PROMPT,
    "outfit_woman": OUTFIT_WOMAN_PROMPT,
    "outfit_man": OUTFIT_MAN_PROMPT,
    "accessories": ACCESSORIES_PROMPT,
    "before_after": BEFORE_AFTER_PROMPT,
}


def build_image_prompt(report_type: str) -> str:
    template = PROMPT_BY_REPORT.get(report_type)
    if template is None:
        raise ValueError(f"Unknown report_type: {report_type}")
    return template
