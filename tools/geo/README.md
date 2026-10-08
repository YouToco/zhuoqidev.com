# Map data

The visitor map (`src/pages/[...lang]/visitors/`) draws a globe and a map of China in the browser
from three small files in `src/data/geo/`, built here and checked in:

- `land.json`: where the land is, as a 0.5° bitmap (Natural Earth 50m land). The globe turns it
  into dots. It has no borders on purpose, so the globe takes no side on any border.
- `countries.json`: one point per ISO country code (Natural Earth's label point), where that
  country's readers rise from the globe.
- `china.json`: China's provinces, Hong Kong, Macao and Taiwan, with the nine-dash line, from
  DataV.GeoAtlas (AutoNavi data). The provinces are simplified with shared borders kept shared;
  the dashes are kept as published. The map shows the South China Sea Islands in an inset, as the
  standard map does. Do not swap in a source that leaves out Taiwan, the islands or the line.

Regenerate (downloads the pinned sources; nothing else on the site needs the network):

```bash
npm run geo
```
