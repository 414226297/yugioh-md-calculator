# Native report resources

Extracted read-only from the user's installed Master Duel static resources. No game files were changed. These game UI textures and bundled fonts are distinct from the BSD-licensed upstream tooling; original rights remain with their respective owners.

- GUI_CardInfo_NameBase: title and category strips, tinted by card category.
- GUI_Global_Window_Frame: native metallic corner/frame. The _trim derivative removes atlas padding before nine-slice rendering.
- GUI_Global_Window_Base: report background texture.
- GUI_CommonScrollBar: scroll thumb nine-slice.
- GUI_Icon_Rarity0 through 3: N, R, SR, UR.
- FZYouHJW_509R and FZYouHJW_512B: simplified Chinese regular/bold fonts shipped in the game. The -outline copies preserve glyphs and adjust the gasp rendering flags for browser rasterization; they do not redraw characters.

Exact game-relative paths, transformations and SHA-256 are in sources.json. UI tint, geometry, spacing and composition remain application CSS: these have been visually calibrated, not extracted as the game's original layout prefab. Card pictures and effect content retain their existing source.
