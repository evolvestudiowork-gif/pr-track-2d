/*
 * Match Premiere's panel appearance. CEP reports the host panel colour and
 * base font; every surface colour is derived from that background so the
 * panel follows the user's brightness setting (Preferences > Appearance).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    root.TrackTheme = api;
    api.install(root);
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  var THEME_CHANGED = 'com.adobe.csxs.events.ThemeColorChanged';
  var PREMIERE_DEFAULT_BG = { red: 35, green: 35, blue: 35 }; // #232323

  function clamp(n) {
    return Math.max(0, Math.min(255, Math.round(n)));
  }

  function hex(c) {
    return (
      '#' +
      [c.red, c.green, c.blue]
        .map(function (v) {
          return ('0' + clamp(v).toString(16)).slice(-2);
        })
        .join('')
    );
  }

  /** Move a colour towards white (amount > 0) or black (amount < 0). */
  function shade(c, amount) {
    var target = amount > 0 ? 255 : 0;
    var t = Math.abs(amount);
    return {
      red: c.red + (target - c.red) * t,
      green: c.green + (target - c.green) * t,
      blue: c.blue + (target - c.blue) * t
    };
  }

  function luminance(c) {
    return (0.2126 * c.red + 0.7152 * c.green + 0.0722 * c.blue) / 255;
  }

  /** CSS custom properties for a given panel background colour. */
  function palette(bg) {
    var light = luminance(bg) > 0.5;
    // "Raise" means further from the background, towards contrast.
    var raise = light ? -1 : 1;
    return {
      light: light,
      vars: {
        '--bg': hex(bg),
        // Text fields: darker than a dark panel, near-white on a light one.
        '--bg-sunken': hex(light ? shade(bg, 0.6) : shade(bg, -0.25)),
        '--bg-viewport': hex(shade(bg, -0.45)),
        '--surface': hex(shade(bg, 0.09 * raise)),
        '--surface-hover': hex(shade(bg, 0.15 * raise)),
        '--track': hex(shade(bg, 0.14 * raise)),
        '--line': hex(shade(bg, 0.1 * raise)),
        '--line-strong': hex(shade(bg, 0.2 * raise)),
        '--text': light ? '#1d1d1d' : '#e3e3e3',
        '--muted': light ? '#5c5c5c' : '#a3a3a3'
      }
    };
  }

  function apply(doc, skin) {
    var bg =
      (skin && skin.panelBackgroundColor && skin.panelBackgroundColor.color) || PREMIERE_DEFAULT_BG;
    var theme = palette(bg);
    var style = doc.documentElement.style;
    Object.keys(theme.vars).forEach(function (name) {
      style.setProperty(name, theme.vars[name]);
    });
    style.setProperty('color-scheme', theme.light ? 'light' : 'dark');
    // Premiere reports ~10px; native panels render text slightly larger than that.
    if (skin && skin.baseFontSize)
      style.setProperty('--font-size', Math.max(11, skin.baseFontSize) + 'px');
    if (skin && skin.baseFontFamily)
      style.setProperty('--font-family', '"' + skin.baseFontFamily + '", system-ui, sans-serif');
    doc.documentElement.setAttribute('data-theme', theme.light ? 'light' : 'dark');
  }

  function hostSkin(root) {
    try {
      return JSON.parse(root.__adobe_cep__.getHostEnvironment()).appSkinInfo;
    } catch (_) {
      return null; // opened outside Premiere: use the default dark panel
    }
  }

  function install(root) {
    apply(root.document, hostSkin(root));
    if (root.__adobe_cep__ && root.__adobe_cep__.addEventListener)
      root.__adobe_cep__.addEventListener(THEME_CHANGED, function () {
        apply(root.document, hostSkin(root));
      });
  }

  return { palette: palette, apply: apply, install: install };
});
