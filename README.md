# rum.

En rumsplanerare i SvelteKit och Svelte 5. Kör `pnpm install` och `pnpm dev` och öppna adressen som skrivs ut i terminalen.

- Ange rummets invändiga bredd, djup och takhöjd i cm.
- Lägg till möbler och ändra mått, höjd, höjd över golvet, position och rotation i detaljpanelen. Positioner avser möbelns centrum. Runda bord har justerbar diameter.
- Växla mellan 2D och en enkel 3D-vy. Dra i 3D-vyn för att vrida och luta kameran, eller använd reglagen.
- Lägg till en människomodell med justerbar längd som storleksreferens. Kryssrutan Visa människomodell visar eller döljer den.
- Fönsterbräde finns under Dörrar & fönster och visas uppifrån med ändringsbar bredd och djup.
- Dra objekt eller använd piltangenterna. Shift ger steg om 10 cm. R roterar en möbel 90°.
- Fäst vid 5 cm är aktiverat som standard. Vid dragning snäpper möbler även mot väggar och närliggande möblers kanter och centrum. Håll Alt för fri placering. Detaljpanelens exakta positioner påverkas inte av snäppning.
- Ångra/gör om med knapparna, Ctrl/⌘+Z och Ctrl/⌘+Skift+Z eller Ctrl+Y. Varje dragning är ett steg. Historiken gäller det öppna rummet under den aktuella sessionen.
- Markerade objekt visar måttlinjer till närmaste vägg eller objekt i varje riktning. Avstånden i cm uppdateras direkt när du flyttar objektet, även för roterade möbler.
- Dörrar, dörröppningar utan dörr och fönster har justerbar bredd, höjd och placering på väggen. Fönster har även ett avstånd från golv till underkant. Öppningarna måste rymmas under taket. För dörrar kan du välja gångjärn till vänster eller höger, sett inifrån rummet, samt öppning inåt eller utåt.
- Under El & ljus finns eluttag och lampor som placeringssymboler. Ange position i cm eller dra dem; symbolerna visas förstorade ovanpå möblerna och har ingen fysisk storlek i ritningen.
- Arbetsritningen sparas automatiskt i den aktuella webbläsaren. Ge rummet ett namn och välj Spara rum för att lägga det i listan Öppna sparat rum. Nytt rum sparar först det aktuella rummet och börjar sedan med ett tomt rum. Även när du byter mellan sparade rum sparas det aktuella först. SVG-export ger en fristående måttbild med skiss och måttlista. Under Utskriftsvy kan du förhandsgranska i svartvitt, förstora bilden och välja Skriv ut. Eluttag visas med symbol och namn utan mått eller avstånd. En dold människomodell tas inte med i export eller utskrift. Utskriften anpassas till sidan.

En SVG-enhet motsvarar en centimeter. Samma skalning används i båda axlarna och vid zoom. Rutnätets små rutor är 10 × 10 cm. Möblernas mått ändras aldrig automatiskt; positionen anpassas så att hela den roterade möbeln ryms. Möbler får överlappa. Dörrsymbolen visar öppningsbredd och en valbar svängradie inåt eller utåt; fönstersymbolens tjocklek är schematisk.

`pnpm check` kontrollerar Svelte och JavaScript. `pnpm test` verifierar geometri och gränser. `pnpm build` skapar en statisk app i `build/`.

Lokala förhandsbilder (`preview*.png`), pnpm-cache och genererade byggfiler ignoreras av Git och behövs inte för att köra appen eller testerna.
