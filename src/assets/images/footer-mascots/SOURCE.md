# Footer chibi fan-art assets

Created on 2026-10-01 with the built-in image_gen tool for this personal blog. These are generated fan-art illustrations, not downloaded official artwork and not an open-source character-art collection. Character and franchise rights remain with their respective rights holders; the repository's code/content license does not grant rights to these characters or reference images.

## Files and references

- `taffy.png`: 永雏塔菲 / Ace Taffy. Creator profile: https://space.bilibili.com/1265680561 . Identity reference: https://www.bilibili.com/read/cv32642409/ (https://i0.hdslb.com/bfs/new_dyn/7db04913f312eb7be4b3b6bb0422f088384628005.jpg). Used as an appearance reference, not copied into the site.
- `mambo.png`: 待兼诗歌剧 / Matikanetannhauser, the Uma Musume character associated with the Mambo meme. Official identity reference: https://umamusume.jp/character/matikanetannhauser . Fan-work guidance: https://umamusume.jp/derivativework_guidelines/ . Rights belong to Cygames and relevant rights holders.
- `roxy.png`: 洛琪希 / Roxy Migurdia, Mushoku Tensei. Official character page: https://mushokutensei.jp/character/ . Outfit reference: licensed merchandise at https://www.charaon.jp/SHOP/AZMTI44.html (https://image1.shopserve.jp/charaon.jp/pic-labo/llimg/AZMTI44_01.jpg). Used only to establish identity and wardrobe.

Style references are the existing project mascots `public/pio/models/pets/feibi/loader-feibi-unified.webp` and `public/pio/models/pets/deepseek/loader-deepseek-whale-girl.webp`; neither was modified. Each generation used those two images followed by the corresponding identity reference, with `transparent_background: true`.

The source PNGs retain their generated alpha. Astro Image emits 256 × 256 WebP versions for the footer; CSS keeps the same 4.5–6.5rem visual box as the existing companions.

## Final prompt set

Each subject prompt below was appended to this shared prefix, with three reference images in the order described above.

### Shared prefix

```text
Use case: stylized-concept
Asset type: transparent personal-blog footer chibi companion.
Input images: Image 1 and Image 2 are STYLE references only, not character identities. Image 3 is the CHARACTER IDENTITY / wardrobe reference only. Match the clean cute drawing style of Images 1 and 2 while drawing the new character from Image 3.
Style: polished 2D anime chibi, about two heads tall, very oversized round head, tiny fully clothed body and short limbs, large glossy expressive eyes, blush cheeks, warm soft cel shading, crisp rounded dark-brown outlines. Match the existing companions, not a 3D render or realistic anime body.
Composition: exactly one full-body standing character centered on a square canvas, compact silhouette, entire hat/ears/hair/feet/accessories visible, occupying approximately 92% of canvas height, feet near bottom with a small transparent margin. Genuine alpha transparency around the character. No background, scenery, floor, badge, sticker border, drop shadow, label, text, logo, watermark, or extra character.
```

### taffy

```text
Primary request: draw a new fan-art chibi of 永雏塔菲 (Ace Taffy), recognizable by fluffy pink hair in two small braided pigtails with red ribbons, rounded pink bangs, golden amber eyes, brass steampunk goggles resting on her head. Use the identity of Image 3, but not its cropped composition, sweat-drop symbol, or exact artwork. Fully clothed cute brown-and-cream steampunk uniform with a white collar, red neck ribbon, gold-trimmed brown jacket/corset, small layered brown skirt, stockings and short boots. A sweet tiny smile and one small welcoming wave. Keep goggles, braids, eyes and outfit readable when shown at about 104 pixels tall.
```

### mambo

```text
Primary request: draw a new fan-art chibi of 待兼诗歌剧 / Matikanetannhauser from Uma Musume Pretty Derby, the character from the Mambo meme. She is a HUMAN horse-girl, not a four-legged horse. Preserve Image 3's chestnut/mauve-brown wavy hair, pale cream streak in her bangs, two red hair clips, horse ears and horse tail, amber golden eyes, lavender/navy cap with white band. Simplify her canonical outfit into cute readable chibi detail: navy neck bow and frilled white high collar, puffy white sleeves, reddish-brown corset with pale blue lacing, navy skirt with small cream floral motifs and white ruffled underskirt, tan/brown coat folds and brown boots with light tan cuffs. Happy gentle smile and two tiny fists raised in a cheerful 'ei ei mun' pose. Compact small tail, no text or meme caption.
```

### roxy

```text
Primary request: draw a new fan-art chibi of 洛琪希 / Roxy Migurdia from Mushoku Tensei. Preserve Image 3's muted blue hair, two long braided pigtails, large blue eyes, oversized charcoal witch hat with a gold band between two pale gray stripes. Fully clothed canonical mage outfit: brown/tan broad-collared cloak, cream front vest with blue trim, dark bodice and chest lacing, small dark ruffled skirt, dark boots with pale fur trim. Sweet calm small smile, one small hand waves and the other holds her compact magic staff with a dark shaft and an angular pale silver head with a tiny blue jewel. Entire hat, staff, braids and both boots visible. Do not copy the merchandise graphic, its outline, any text, circular label, or logo.
```
