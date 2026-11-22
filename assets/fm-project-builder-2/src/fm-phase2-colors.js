/*
 * Fremont Makers · Project Builder · Phase 2 · Cabinet colors (FMColors)
 * Version 1.0.0. Pure functions and data: no DOM, storage, network or clock. UMD: window.FMColors in a browser.
 *
 * Owner, Nov 20: an easy way to add cabinet colors to designs, from the catalog on fremontmakers.com/catalog, with a color
 * chip and a plain name (not the supplier's exact cabinet name). CATALOG is the website's 88 collections as of Nov 20, 2026
 * (name, collection, and a chip sampled from each door photo). SHOP is what the shop already sells under supplier codes.
 * The team's own list is the company setting cabinetColors: [catalog key | { key, name, hex }]. HANDOFF §44.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FMColors = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';
  /* [key, name, collection, chip] from fremontmakers.com/catalog (key is the page: /catalog/<key>) */
  var CATALOG = [
    ['bayview-white-shaker', 'Bayview White Shaker', 'Bayview', '#f7f6f2'],
    ['natural-wood-shaker', 'Natural Wood Shaker', 'Natural Wood', '#d6b58a'],
    ['bayview-gray-shaker', 'Bayview Grey Shaker', 'Bayview', '#83878b'],
    ['castle-gray-shaker-vanity', 'Castle Grey Shaker Vanity', 'Castle Grey', '#828688'],
    ['lancaster-dark-grey', 'Lancaster Dark Grey', 'Lancaster', '#787881'],
    ['french-blue-shaker', 'French Blue Shaker', 'French Blue', '#57748e'],
    ['slim-dark-green', 'Slim Dark Green', 'Slim', '#445133'],
    ['elegant-sand-shaker', 'Elegant Sand Shaker', 'Elegant Sand', '#d0c9b9'],
    ['bayview-wood-shaker', 'Bayview Wood Shaker', 'Bayview', '#b99a6f'],
    ['lancaster-charcoal', 'Lancaster Charcoal', 'Lancaster', '#39301f'],
    ['princeton-cream-glaze', 'Princeton Cream Glaze', 'Princeton', '#f2ead8'],
    ['dream-white', 'Dream White', 'Dream', '#ececec'],
    ['majestic-sage-green', 'Majestic Sage Green', 'Majestic', '#939987'],
    ['true-black-gloss', 'True Black Gloss', 'True Black', '#161616'],
    ['verona-gloss-white', 'Verona Gloss White', 'Verona', '#f3f3f3'],
    ['navy-blue-shaker', 'Navy Blue Shaker', 'Navy Blue', '#1a2745'],
    ['bayview-black-shaker', 'Bayview Black Shaker', 'Bayview', '#151515'],
    ['dark-hickory-shaker', 'Dark Hickory Shaker', 'Hickory', '#5a4332'],
    ['dolphin-grey-shaker', 'Dolphin Grey Shaker', 'Dolphin', '#abacb0'],
    ['slim-white-shaker', 'Slim White Shaker', 'Slim', '#e3e1e0'],
    ['antique-white-shaker', 'Antique White Shaker', 'Antique White', '#f9f6ea'],
    ['augusta-ash', 'Augusta Ash', 'Augusta', '#52554c'],
    ['augusta-white', 'Augusta White', 'Augusta', '#e7e7e5'],
    ['bayview-blue-shaker', 'Bayview Blue Shaker', 'Bayview', '#232834'],
    ['bayview-green-shaker', 'Bayview Green Shaker', 'Bayview', '#38452e'],
    ['bayview-stained-shaker', 'Bayview Stained Shaker', 'Bayview', '#2c1613'],
    ['belgian-beige', 'Belgian Beige', 'Belgian Beige', '#bbb1a9'],
    ['biscay-gloss', 'Biscay Gloss', 'Biscay', '#20100d'],
    ['bright-white-shaker', 'Bright White Shaker', 'Bright White Shaker', '#f3f3f5'],
    ['castle-grey-shaker', 'Castle Grey Shaker', 'Castle Grey', '#828688'],
    ['celebration-ash', 'Celebration Ash', 'Celebration', '#444439'],
    ['celebration-white', 'Celebration White', 'Celebration', '#f2f2f2'],
    ['charleston-antique-white', 'Charleston Antique White', 'Charleston', '#ece9e1'],
    ['charleston-saddle', 'Charleston Saddle', 'Charleston Saddle', '#5d3422'],
    ['cinder-shaker', 'Cinder Shaker', 'Cinder', '#4e4b46'],
    ['clear-white-shaker', 'Clear White Shaker', 'Clear White', '#fcfcfc'],
    ['concord-white-shaker', 'Concord White Shaker', 'Concord', '#f2f2f1'],
    ['crystal-white-shaker', 'Crystal White Shaker', 'Crystal White', '#f9f9f9'],
    ['cumberland-pearl', 'Cumberland Pearl', 'Cumberland', '#e1d6ce'],
    ['daisy-white-shaker', 'Daisy White Shaker', 'Daisy White', '#f1f1f0'],
    ['dark-bay-shaker', 'Dark Bay Shaker', 'Dark Bay', '#261a1e'],
    ['deep-blue-shaker', 'Deep Blue Shaker', 'Deep Blue', '#1b2431'],
    ['dove-shaker', 'Dove Shaker', 'Dove', '#d4cfc5'],
    ['elsinore-blue', 'Elsinore Blue', 'Elsinore', '#363e52'],
    ['faro-off-white', 'Faro Off White', 'Faro', '#efefef'],
    ['glasgow-grey', 'Glasgow Grey', 'Glasgow Grey', '#6b6c70'],
    ['glossy-oak', 'Glossy Oak', 'Glossy Oak', '#64432a'],
    ['grey-shaker', 'Grey Shaker', 'Grey Shaker', '#6d7170'],
    ['harbor-grey-shaker', 'Harbor Grey Shaker', 'Harbor Grey', '#6b6f71'],
    ['heritage-cinnamon', 'Heritage Cinnamon', 'Heritage Cinnamon', '#714a28'],
    ['hudson-ash', 'Hudson Ash', 'Hudson', '#4b4740'],
    ['hudson-grey', 'Hudson Grey', 'Hudson', '#a4a4a4'],
    ['hudson-pewter', 'Hudson Pewter', 'Hudson', '#888a7e'],
    ['lancaster-ocean-blue', 'Lancaster Ocean Blue', 'Lancaster', '#2e5171'],
    ['lancaster-stone', 'Lancaster Stone', 'Lancaster', '#b6a07b'],
    ['lexington-ash-shaker', 'Lexington Ash Shaker', 'Lexington', '#4a4544'],
    ['lexington-brownstone-shaker', 'Lexington Brownstone Shaker', 'Lexington', '#453a29'],
    ['lexington-dark-shaker', 'Lexington Dark Shaker', 'Lexington', '#31271e'],
    ['lexington-grey-shaker', 'Lexington Grey Shaker', 'Lexington', '#b3b0aa'],
    ['lexington-honey-shaker', 'Lexington Honey Shaker', 'Lexington', '#ac7442'],
    ['lexington-white-shaker', 'Lexington White Shaker', 'Lexington', '#ececec'],
    ['light-wood-gloss', 'Light Wood Gloss', 'Light Wood Gloss', '#835a34'],
    ['majestic-grey', 'Majestic Grey', 'Majestic', '#a5a19e'],
    ['majestic-light-wood', 'Majestic Light Wood', 'Majestic', '#a18161'],
    ['majestic-white', 'Majestic White', 'Majestic', '#f1f4f2'],
    ['mediterranean-stone', 'Mediterranean Stone', 'Mediterranean Stone', '#a4a6a9'],
    ['midnight-blue-shaker', 'Midnight Blue Shaker', 'Midnight Blue', '#192843'],
    ['newcastle-charcoal', 'Newcastle Charcoal', 'Newcastle', '#25262a'],
    ['newcastle-dove', 'Newcastle Dove', 'Newcastle', '#dbd7d3'],
    ['newport-espresso', 'Newport Espresso', 'Newport', '#191713'],
    ['newport-white', 'Newport White', 'Newport', '#efefef'],
    ['nordic-white-shaker', 'Nordic White Shaker', 'Nordic White', '#f3f3f3'],
    ['ornate-grey', 'Ornate Grey', 'Ornate Grey', '#3d3832'],
    ['ornate-white', 'Ornate White', 'Ornate White', '#f7f7f5'],
    ['pearl-glaze', 'Pearl Glaze', 'Pearl Glaze', '#e6e1d8'],
    ['princeton-off-white', 'Princeton Off White', 'Princeton', '#e6e5dc'],
    ['sanibel-cream', 'Sanibel Cream', 'Sanibel', '#e8e3d9'],
    ['sanibel-white', 'Sanibel White', 'Sanibel', '#e3e3e3'],
    ['scandi-sage-green', 'Scandi Sage Green', 'Scandi', '#b9bda5'],
    ['shetland-grey', 'Shetland Grey', 'Shetland Grey', '#575455'],
    ['slate-grey-shaker', 'Slate Grey Shaker', 'Slate Grey', '#5f605f'],
    ['slim-white-oak', 'Slim White Oak', 'Slim White Oak', '#b8a180'],
    ['true-black-matte', 'True Black Matte', 'True Black Matte', '#181713'],
    ['true-black-shaker', 'True Black Shaker', 'True Black', '#0e0e0e'],
    ['valencia-off-white', 'Valencia Off White', 'Valencia', '#eaeaea'],
    ['white-shaker', 'White Shaker', 'White Shaker', '#ebebea'],
    ['yorktown-white-shaker', 'Yorktown White Shaker', 'Yorktown', '#ebebed'],
    ['zealand-white', 'Zealand White', 'Zealand', '#ffffff']
  ].map(function (r) { return { key: r[0], name: r[1], collection: r[2], hex: r[3], url: 'https://fremontmakers.com/catalog/' + r[0] }; });
  /* The supplier codes on SKUs (W3042-SBW) and the sketch colors, with plain names. */
  var SHOP = [
    { key: 'SBW', name: 'White', full: 'Bayview White Shaker', hex: '#f4f1ea', catalog: 'bayview-white-shaker' },
    { key: 'SWD', name: 'Natural wood', full: 'Bayview Wood Shaker', hex: '#c89f72', catalog: 'bayview-wood-shaker' },
    { key: 'UMO', name: 'Moss green', full: 'Moss Green Shaker', hex: '#7c8f6e' },
    { key: 'VDH', name: 'Dark hickory', full: 'Dark Hickory Shaker', hex: '#5a4332', catalog: 'dark-hickory-shaker' },
    { key: 'SGR', name: 'Gray', full: 'Gray Shaker', hex: '#a7adaa' },
    { key: 'NVY', name: 'Navy', full: 'Navy Shaker', hex: '#34435a' }
  ];
  var BY = {}; CATALOG.forEach(function (c) { BY[c.key] = c; }); SHOP.forEach(function (c) { BY[c.key] = c; });
  var custom = {};   // the team's own colors, set by use()

  function isHex(s) { return /^#[0-9a-f]{6}$/i.test(String(s || '')); }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  /* Plain name: "Bayview White Shaker" → "Bayview White"; shop codes give their short name. */
  function plain(name) { return String(name || '').replace(/ Shaker( Vanity)?$/, '').trim(); }

  /* Tell FMColors about the team's list (settings.cabinetColors), so names and chips resolve everywhere. */
  function use(list) {
    custom = {};
    (list || []).forEach(function (x) { if (x && typeof x === 'object' && x.key && isHex(x.hex)) custom[x.key] = { key: x.key, name: x.name, hex: x.hex, custom: true }; });
  }
  function get(key) { return custom[key] || BY[key] || null; }
  function hex(key) { if (isHex(key)) return key; var c = get(key); return c ? c.hex : null; }
  function name(key) { var c = get(key); return c ? (c.full || c.name) : (key || ''); }
  function short(key) { var c = get(key); return c ? (c.full ? c.name : plain(c.name)) : (key || ''); }

  /* The colors to choose from: the shop's four, then the team's list, in order. */
  function choices(list) {
    var out = SHOP.slice(0, 4).map(function (c) { return { key: c.key, name: c.name, hex: c.hex }; }), seen = {}; out.forEach(function (c) { seen[c.key] = 1; });
    (list || []).forEach(function (x) {
      var c = typeof x === 'string' ? BY[x] : x && isHex(x.hex) ? x : null;
      if (c && !seen[c.key]) { seen[c.key] = 1; out.push({ key: c.key, name: c.full ? c.name : plain(c.name), hex: c.hex }); }
    });
    return out;
  }
  /* Catalog colors matching a search (name, collection), not already chosen. */
  function search(q, list) {
    var have = {}; choices(list).forEach(function (c) { have[c.key] = 1; }); SHOP.forEach(function (s) { if (s.catalog && have[s.key]) have[s.catalog] = 1; });
    var t = String(q || '').toLowerCase().trim();
    return CATALOG.filter(function (c) { return !have[c.key] && (!t || (c.name + ' ' + c.collection).toLowerCase().indexOf(t) >= 0); });
  }
  /* Add a catalog color or a custom one to the team's list. Returns { ok, list, error }. Never changes the list passed in. */
  function add(list, input) {
    var cur = (list || []).slice();
    if (typeof input === 'string') {
      if (!BY[input] || SHOP.some(function (s) { return s.key === input; })) return { ok: false, error: 'Pick a color from the catalog.' };
      if (cur.indexOf(input) >= 0) return { ok: false, error: BY[input].name + ' is already on your list.' };
      return { ok: true, list: cur.concat([input]), key: input };
    }
    var nm = String(input && input.name || '').trim();
    if (!nm) return { ok: false, error: 'Name the color.' };
    if (!isHex(input.hex)) return { ok: false, error: 'Pick the color.' };
    var key = 'c-' + slug(nm);
    if (cur.some(function (x) { return (typeof x === 'string' ? x : x.key) === key; }) || BY[key]) return { ok: false, error: nm + ' is already on your list.' };
    return { ok: true, list: cur.concat([{ key: key, name: nm, hex: input.hex.toLowerCase() }]), key: key };
  }
  function remove(list, key) { return (list || []).filter(function (x) { return (typeof x === 'string' ? x : x.key) !== key; }); }

  return { VERSION: VERSION, CATALOG: CATALOG, SHOP: SHOP, use: use, get: get, hex: hex, name: name, short: short, choices: choices, search: search, add: add, remove: remove, isHex: isHex };
}));
