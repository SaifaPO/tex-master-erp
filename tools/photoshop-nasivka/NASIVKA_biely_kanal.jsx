// Nášivka / výšivka -> biely kanál (spot kanál W1) pre tlač 3D transferov.
// Automatizuje postup z videa: kópia vrstvy -> Find Edges -> Threshold -> výber čiernej/bielej plochy -> nový Spot Channel "W1" -> uloženie TIFF.
// Spustenie: Photoshop -> File -> Scripts -> Browse... -> tento súbor. Podrobný návod je v NAVOD.md.
// Pôvodná vrstva (obrázok s efektom výšivky) ostáva nedotknutá, skript len pridá kanál W1 (a pomocné veci po sebe zmaže).
#target photoshop

var NAZOV_KANALA = 'W1';          // názov spot kanála, ktorý očakáva RIP (v videu "W1")
var DEFAULT_PRAH = 115;           // Threshold – v videu 105 až 125 (nižšie = menej čiernej, vyššie = viac čiernej)
var ULOZIT_TIFF_KOMPRESIA = TIFFEncoding.TIFFLZW;   // ak RIP nezvláda LZW, zmeň na TIFFEncoding.NONE

var cTID = function (s) { return charIDToTypeID(s); };

function dialogParametre(p) {
  var w = new Window('dialog', 'Nášivka – biely kanál (' + NAZOV_KANALA + ')');
  w.orientation = 'column'; w.alignChildren = 'fill';

  var g1 = w.add('group');
  g1.add('statictext', undefined, 'Prah (Threshold) 1–255:');
  var e = g1.add('edittext', undefined, String(p.prah)); e.characters = 5;
  var sl = w.add('slider', undefined, p.prah, 1, 255);
  sl.onChanging = function () { e.text = String(Math.round(sl.value)); };
  e.onChanging = function () { var v = parseInt(e.text, 10); if (!isNaN(v) && v >= 1 && v <= 255) sl.value = v; };
  w.add('statictext', undefined, 'Vyšší prah = viac čiernej plochy. V ukážke sa to dá potom prestaviť a skúsiť znova.');

  var pn = w.add('panel', undefined, 'Kde bude biela farba');
  pn.alignChildren = 'left';
  var rTmave = pn.add('radiobutton', undefined, 'Na čiernej ploche (hrany a stehy – ako vo videu)');
  var rSvetle = pn.add('radiobutton', undefined, 'Na bielej ploche (výplň medzi stehmi)');
  rTmave.value = p.tmave; rSvetle.value = !p.tmave;

  var gb = w.add('group'); gb.alignment = 'right';
  gb.add('button', undefined, 'OK', { name: 'ok' });
  gb.add('button', undefined, 'Zrušiť', { name: 'cancel' });

  if (w.show() !== 1) return null;
  var v = parseInt(e.text, 10);
  if (isNaN(v) || v < 1 || v > 255) v = p.prah;
  return { prah: v, tmave: rTmave.value };
}

function kanalExistuje(doc, nazov) {
  for (var i = 0; i < doc.channels.length; i++) if (doc.channels[i].name === nazov) return doc.channels[i];
  return null;
}

function indexVrstvy(doc, vrstva) {
  for (var i = 0; i < doc.layers.length; i++) if (doc.layers[i].id === vrstva.id) return i;
  return -1;
}

// Čiernobiela maska (Find Edges + Threshold) z kópie dokumentu -> vložená ako dočasný alfa kanál do pôvodného dokumentu
function vlozMaskuDoKanala(doc, idx, prah, nazovKanala) {
  var biela = new SolidColor(); biela.rgb.red = 255; biela.rgb.green = 255; biela.rgb.blue = 255;
  var tmp = doc.duplicate('_tmp_nasivka', false);
  app.activeDocument = tmp;
  // ponechaj iba vrstvu s logom
  for (var i = tmp.layers.length - 1; i >= 0; i--) if (i !== idx) tmp.layers[i].remove();
  var lay = tmp.layers[0];
  tmp.activeLayer = lay;
  if (lay.kind === LayerKind.SMARTOBJECT) lay.rasterize(RasterizeType.ENTIRELAYER);
  // biele pozadie pod logom, aby priehľadnosť nerobila problémy
  var bg = tmp.artLayers.add();
  tmp.selection.selectAll(); tmp.selection.fill(biela); tmp.selection.deselect();
  bg.move(tmp.layers[tmp.layers.length - 1], ElementPlacement.PLACEAFTER);
  tmp.flatten();
  // Filter -> Stylize -> Find Edges
  executeAction(cTID('FndE'), undefined, DialogModes.NO);
  // Threshold
  var d = new ActionDescriptor(); d.putInteger(cTID('Lvl '), prah);
  executeAction(cTID('Thrs'), d, DialogModes.NO);
  tmp.changeMode(ChangeMode.GRAYSCALE);
  tmp.selection.selectAll(); tmp.selection.copy();
  tmp.close(SaveOptions.DONOTSAVECHANGES);

  app.activeDocument = doc;
  doc.selection.deselect();
  var ch = doc.channels.add(); ch.name = nazovKanala;   // alfa kanál
  doc.activeChannels = [ch];
  doc.paste();
  doc.selection.deselect();
  return ch;
}

function prienikSPriehladnostou() {
  var d = new ActionDescriptor();
  var r = new ActionReference(); r.putEnumerated(cTID('Chnl'), cTID('Chnl'), cTID('Trsp'));
  d.putReference(cTID('null'), r);
  var r2 = new ActionReference(); r2.putProperty(cTID('Chnl'), cTID('fsel'));
  d.putReference(cTID('With'), r2);
  executeAction(cTID('Intr'), d, DialogModes.NO);
}

function vytvorBielyKanal(doc, orig, idx, p) {
  var staryKanal = kanalExistuje(doc, NAZOV_KANALA);
  if (staryKanal) staryKanal.remove();

  var maska = vlozMaskuDoKanala(doc, idx, p.prah, '_nasivka_maska');
  doc.selection.load(maska, SelectionType.REPLACE);   // biela v maske = vybraté
  if (p.tmave) doc.selection.invert();                // čierna plocha = biela farba
  maska.remove();

  // biela farba len tam, kde je logo (nie v priehľadnom okolí)
  doc.activeLayer = orig;
  try { prienikSPriehladnostou(); } catch (e) { /* vrstva bez priehľadnosti (napr. Background) – nevadí */ }

  try { var b = doc.selection.bounds; } catch (e2) { throw new Error('Pri tomto prahu je plocha pre bielu farbu prázdna. Skús iný prah alebo druhú možnosť.'); }

  var spot = doc.channels.add();
  spot.kind = ChannelType.SPOTCOLOR;
  spot.name = NAZOV_KANALA;
  var zelena = new SolidColor(); zelena.rgb.red = 36; zelena.rgb.green = 255; zelena.rgb.blue = 0;   // len na zobrazenie, tlač neovplyvní
  spot.color = zelena;
  spot.opacity = 100;
  doc.activeChannels = [spot];
  var cierna = new SolidColor(); cierna.rgb.red = 0; cierna.rgb.green = 0; cierna.rgb.blue = 0;
  doc.selection.fill(cierna);                         // 100 % bielej farby
  doc.selection.deselect();
  doc.activeChannels = doc.componentChannels;
  spot.visible = true;
  doc.activeLayer = orig;
}

function ulozTiff(doc) {
  var predvolene = 'nasivka_W1.tif';
  var f;
  try { f = new File(doc.path + '/' + doc.name.replace(/\.[^\.]+$/, '') + '_W1.tif'); } catch (e) { f = File(predvolene); }
  f = f.saveDialog('Uložiť TIFF pre RIP (s kanálom ' + NAZOV_KANALA + ')', 'TIFF:*.tif;*.tiff');
  if (!f) return false;
  var o = new TiffSaveOptions();
  o.spotColors = true;      // ✔ Spot Colors (ako vo videu)
  o.layers = true;          // ✔ Layers (ako vo videu)
  o.alphaChannels = false;
  o.embedColorProfile = true;
  o.imageCompression = ULOZIT_TIFF_KOMPRESIA;
  doc.saveAs(f, o, true);   // true = ako kópia, pracovný dokument ostáva
  return true;
}

function main() {
  if (app.documents.length === 0) { alert('Najprv otvor obrázok s efektom výšivky (ideálne s vrstvou loga na priehľadnom pozadí).'); return; }
  var doc = app.activeDocument;
  var orig = doc.activeLayer;
  var idx = indexVrstvy(doc, orig);
  if (idx < 0) { alert('Označ vrstvu s logom, ktorá je na najvyššej úrovni (nie vo vnútri skupiny).'); return; }

  var staraAlerta = app.displayDialogs;
  app.displayDialogs = DialogModes.NO;
  try {
    if (doc.mode !== DocumentMode.CMYK) {
      if (!confirm('Dokument nie je v CMYK. RIP očakáva CMYK + spot kanál ' + NAZOV_KANALA + '.\n\nPrepnúť na CMYK?')) return;
      doc.changeMode(ChangeMode.CMYK);
      orig = doc.activeLayer;
    }
    var snap = doc.activeHistoryState;
    var p = { prah: DEFAULT_PRAH, tmave: true };
    while (true) {
      p = dialogParametre(p);
      if (!p) { doc.activeHistoryState = snap; return; }
      try {
        vytvorBielyKanal(doc, orig, idx, p);
      } catch (e) {
        doc.activeHistoryState = snap;
        alert('Nepodarilo sa: ' + e.message);
        p = { prah: p.prah, tmave: p.tmave };
        continue;
      }
      app.refresh();
      var ok = confirm('Kanál ' + NAZOV_KANALA + ' je vytvorený (zelená plocha = tu pôjde biela farba).\n\nJe to v poriadku?\n\nÁno = pokračovať na uloženie\nNie = vrátiť späť a zadať iný prah');
      if (ok) break;
      var prah = p.prah, tm = p.tmave;
      doc.activeHistoryState = snap;
      p = { prah: prah, tmave: tm };
    }
    if (ulozTiff(doc)) alert('Hotovo. TIFF s kanálom ' + NAZOV_KANALA + ' je uložený – môžeš ho poslať do RIPu.');
    else alert('Kanál ' + NAZOV_KANALA + ' je v dokumente pripravený. Uložiť ho môžeš cez File -> Save As -> TIFF (zapni Spot Colors a Layers).');
  } catch (err) {
    alert('Chyba skriptu: ' + err.message + (err.line ? ' (riadok ' + err.line + ')' : ''));
  } finally {
    app.displayDialogs = staraAlerta;
  }
}

main();
