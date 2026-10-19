# rum.

En rumsplanerare i SvelteKit och Svelte 5. Kör `pnpm install` och `pnpm dev` och öppna adressen som skrivs ut i terminalen.

- Ange rummets invändiga bredd och djup i cm.
- Lägg till möbler och ändra bredd, djup, position och rotation i detaljpanelen. Positioner avser möbelns centrum.
- Fönsterbräde finns under Möbler och visas uppifrån med ändringsbar bredd och djup.
- Dra objekt eller använd piltangenterna. Shift ger steg om 10 cm. R roterar en möbel 90°.
- Vid dragning snäpper möbler lätt mot väggar och närliggande möblers kanter och centrum. Håll Alt för fri placering. Detaljpanelens exakta positioner påverkas inte av snäppning.
- Markerade objekt visar måttlinjer till närmaste vägg eller objekt i varje riktning. Avstånden i cm uppdateras direkt när du flyttar objektet, även för roterade möbler.
- Dörrar och fönster har en bredd och ett avstånd från väggens vänstra eller övre hörn. För dörrar kan du välja gångjärn till vänster eller höger, sett inifrån rummet, samt öppning inåt eller utåt.
- Under El & ljus finns eluttag och lampor som placeringssymboler. Ange position i cm eller dra dem; symbolerna visas förstorade ovanpå möblerna och har ingen fysisk storlek i ritningen.
- Arbetsritningen sparas automatiskt i den aktuella webbläsaren. Ge rummet ett namn och välj Spara rum för att lägga det i listan Öppna sparat rum. Nytt rum sparar först det aktuella rummet och börjar sedan med ett tomt rum. Även när du byter mellan sparade rum sparas det aktuella först. SVG-export ger en fristående måttbild med skiss och måttlista för samtliga objekt. Under Utskriftsvy kan du förhandsgranska i svartvitt, förstora bilden och välja Skriv ut. Utskrift, även direkt från SVG-filen, tar bort färger och inkluderar storlek, placering och närmaste avstånd för alla objekt. Utskriften anpassas till sidan.

En SVG-enhet motsvarar en centimeter. Samma skalning används i båda axlarna och vid zoom. Rutnätets små rutor är 10 × 10 cm. Möblernas mått ändras aldrig automatiskt; positionen anpassas så att hela den roterade möbeln ryms. Möbler får överlappa. Dörrsymbolen visar öppningsbredd och en valbar svängradie inåt eller utåt; fönstersymbolens tjocklek är schematisk.

`pnpm check` kontrollerar Svelte och JavaScript. `pnpm test` verifierar geometri och gränser. `pnpm build` skapar en statisk app i `build/`.
