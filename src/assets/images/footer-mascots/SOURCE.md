# Footer chibi fan-art assets

Created on 2026-10-01 and 2026-10-02 with the built-in image_gen tool for this personal blog. These are generated fan-art illustrations, not downloaded official artwork and not an open-source character-art collection. Character and franchise rights remain with their respective rights holders; the repository's code/content license does not grant rights to these characters or reference images.

## Files and references

- `taffy.png`: 永雏塔菲 / Ace Taffy. Creator profile: https://space.bilibili.com/1265680561 . Identity reference: https://www.bilibili.com/read/cv32642409/ (https://i0.hdslb.com/bfs/new_dyn/7db04913f312eb7be4b3b6bb0422f088384628005.jpg). Used as an appearance reference, not copied into the site.
- `mambo.png`: 待兼诗歌剧 / Matikanetannhauser, the Uma Musume character associated with the Mambo meme. Official identity reference: https://umamusume.jp/character/matikanetannhauser . Fan-work guidance: https://umamusume.jp/derivativework_guidelines/ . Rights belong to Cygames and relevant rights holders.
- `roxy.png`: 洛琪希 / Roxy Migurdia, Mushoku Tensei. Official character page: https://mushokutensei.jp/character/ . Outfit reference: licensed merchandise at https://www.charaon.jp/SHOP/AZMTI44.html (https://image1.shopserve.jp/charaon.jp/pic-labo/llimg/AZMTI44_01.jpg). Used only to establish identity and wardrobe.
- `azusa.png`: 阿梓从小就很可爱 / Azusa. Creator profile: https://space.bilibili.com/7706705 . Appearance reference: creator's song video https://www.bilibili.com/video/BV1rgGc6BEL3/ (https://i1.hdslb.com/bfs/archive/e87d08d2f7c7ca5dfbe3fa8dfa130598a43089d1.jpg).
- `cheese.png`: 雪糕cheese. Creator profile: https://space.bilibili.com/3493139945884106 . Appearance reference: https://www.dcard.tw/f/vtuber/p/253837565 (https://megapx-assets.dcard.tw/images/6ddc00b8-e371-47ac-8cad-79ec01fd1620/1280.jpeg); simplified into matching full-body chibi proportions, not copied.
- `cream.png`: 奶油-cream-. Creator profile: https://space.bilibili.com/3493124999482225 . Appearance reference: creator's video https://www.bilibili.com/video/BV1cNan6VEsE/ (https://i2.hdslb.com/bfs/archive/b198164b5c0ee3275d2d3cc0461f786ce263bd98.jpg).
- `lulu.png`: 雫るる_Official / Shizuku Lulu (not Lulu Suzuhara). Creator profile: https://space.bilibili.com/387636363 . Appearance reference: https://www.bilibili.com/video/BV1u44y1j7xF/ (https://i1.hdslb.com/bfs/archive/db1c5055d9826fcf97cd07aad549521152b5b6d4.jpg). Used only as an identity and outfit reference.

Style references are the existing project mascots `public/pio/models/pets/feibi/loader-feibi-unified.webp` and `public/pio/models/pets/deepseek/loader-deepseek-whale-girl.webp`; neither was modified. Each generation used those two images followed by the corresponding identity reference, with `transparent_background: true`.

The source PNGs retain their generated alpha. Astro Image emits 256 × 256 WebP versions for the footer; CSS keeps boxes up to 6.5rem, fits eleven characters into one desktop row, and retains 4rem boxes with wrapping on phones.

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

## Added on 2026-10-02

Four independent built-in generations used the same two style references followed by each identity reference above, with `transparent_background: true`. The references themselves are not shipped with the site.

### Shared prefix for the new companions

```text
Use case: stylized-concept
Asset type: transparent personal-blog footer chibi companion.
Input images: Image 1 and Image 2 are STYLE references only, not character identities. Image 3 is the CHARACTER IDENTITY / wardrobe reference only. Match the clean cute drawing style of Images 1 and 2 while drawing the new character from Image 3.
Style: polished 2D anime chibi, about two heads tall, very oversized round head, tiny fully clothed body and short limbs, large glossy expressive eyes, blush cheeks, warm soft cel shading, crisp rounded dark-brown outlines. Match the existing companions, not a 3D render or realistic anime body.
Composition: exactly one full-body standing character centered on a square canvas, compact silhouette, entire hair/feet/accessories visible, occupying approximately 92% of canvas height, feet near bottom with a small transparent margin. Genuine alpha transparency around the character. No background, scenery, floor, badge, sticker border, drop shadow, label, text, logo, watermark, or extra character.
```

### azusa

```text
Primary request: draw a new fan-art chibi of 阿梓从小就很可爱 / Azusa. Preserve Image 3's lavender purple hair in two gathered side ponytails, blunt bangs, amber golden eyes with slit pupils, large white butterfly hair ornament edged in black, small black-and-white panda hair accessory and green ribbons. Simplify the black, purple-trimmed Chinese-style outfit with pale gold filigree into a cute fully clothed short qipao-inspired dress, tiny sleeves, jade-green accents, dark stockings and small black shoes. Gentle smile and tiny welcoming wave. Hair accessories must remain readable at about 100px tall. Do not copy the video thumbnail, microphone, text or background.
```

### cheese

```text
Primary request: draw a new fan-art chibi of 雪糕cheese. Preserve Image 3's short ivory-white bob, dark gray underside and dark streak, large white lily ornament with yellow stamens on one side, golden amber eyes, jade-green dangling earrings. Use a fully clothed cute ivory Chinese-style short dress with light gray ornamental cloud patterns and jade-green frog closures and ribbon accents, puff sleeves, opaque white stockings and tiny ivory shoes. Happy soft smile, one small hand raised. Replace the deliberately simplified meme face with large glossy anime-chibi eyes matching STYLE references. No cropped body, no text, no background or extra objects.
```

### cream

```text
Primary request: draw a new fan-art chibi of 奶油-cream-. Preserve Image 3's fluffy light-pink layered hair with long side locks, rounded pink bangs, soft rose-pink eyes, small pale tan curled horns, black and white bone-shaped hairclips and tiny black ribbon on one side. Simplify her black-and-red gothic outfit into a cute fully clothed black ruffled dress, small red ribbon bows, black stockings and little black boots. Sweet playful smile with one tiny hand making a V sign. Hairclips and tiny horns clearly visible, compact silhouette. Do not copy thumbnail pose, handheld fan, text, scenery or exact artwork.
```

### lulu

```text
Primary request: draw a new fan-art chibi of 雫るる_Official / Shizuku Lulu. Preserve Image 3's long straight silver-white hair, neat bangs, bright blue-turquoise eyes, blue/purple butterfly clips on either side. Simplify her recognizable modern aqua-teal oversized jacket with lavender inner lining, white high-neck hoodie and black belt into a cute fully clothed compact outfit: aqua jacket, white hoodie, white pleated skirt, opaque white knee socks and small white shoes. Friendly smile and one tiny hand raised in her signature salute near her forehead. Butterfly clips and teal jacket readable at about 100px tall. No background, text, labels, scenery or extra objects.
```
