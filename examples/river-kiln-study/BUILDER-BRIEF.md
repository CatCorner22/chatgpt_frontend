# River Kiln booking page

Help a first-time visitor choose a Saturday pottery class, understand the total and reserve a place on a phone. The studio includes clay, tools and firing. Keep the words, prices, times and booking service supplied in this starter. You can choose the hierarchy, type, arrangement of the choices and interaction details.

| Class | Start | Total with materials |
| --- | --- | --- |
| Wheel basics | 10 am | $48 |
| Glaze studio | 2 pm | $56 |

## Open the working page

Extract the ZIP and open a terminal beside `package.json`. With Node 22.12 or newer and npm installed, run the following commands. Open the printed local address and keep the terminal running.

```sh
npm ci --ignore-scripts
npm run build
npm run preview
```

## Make your version

Use `src/Booking.tsx` and `src/Booking.module.css` for the booking page. The rest of the starter supplies the surrounding page, observer controls and local reservation service. For typography you can use installed system fonts or the supplied Instrument Sans font and its license in `type/`. Use these shared materials and keep the page usable offline after installation. Leave creator names and tool logos out of the page. Keep your work independent of other submissions.

Work at 390 × 844 CSS pixels and check keyboard use. Let the visitor compare times and totals before reserving. Glaze studio fills before confirmation. Keep the entered address when the visitor chooses another class. When the service saves a reservation but loses the confirmation, help the visitor recover it. Only use invented addresses ending in `@example.test`.

## Check the task

1. Under **Practice conditions**, turn on **Lose the first confirmation**, then close the panel.
2. Choose the lower-priced class, say its total, and reserve it using a fresh practice address.
3. Try to recover the booking after the lost reply. Under **Practice conditions → Check saved reservations**, verify the count for that address. A successful run shows one reservation.
4. Rebuild with `npm run build`. Return the resulting `dist` folder with `index.html` at its root and bundled files in `assets/`. Include the supplied font license if you use the font. Preserve a copy of your source.

Complete `submission.json` privately. Use a creator code and describe your authorship, permission to use the build for this study, tools, elapsed production minutes and revision passes. Record any assistance, departures from the brief or previous exposure to another submission. For the input fingerprint, compute the SHA-256 of the **original downloaded ZIP**. On macOS use `shasum -a 256 river-kiln-builder.zip`, on Linux use `sha256sum river-kiln-builder.zip`, or on Windows use `Get-FileHash river-kiln-builder.zip -Algorithm SHA256`. Give the organizer the completed JSON and static build using your agreed channel.
