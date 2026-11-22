/*
 * Phase 2 preview · reading a supplier PDF in the browser (window.P2Pdf). The text comes from pdf.js; a PDF that's a picture
 * of the page (no text, as most Wholesale Cabinets order PDFs are) is recognized with tesseract.js (OCR). FMSupplierPdf turns
 * the text into items. Live, the server can run the same reader (HANDOFF §40). Libraries load from cdnjs / jsdelivr when first
 * needed.
 */
(function () {
  'use strict';
  var PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js', LANG = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int';
  var loads = {};
  function load(src) { return loads[src] || (loads[src] = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { delete loads[src]; rej(new Error('Couldn\'t load the PDF reader. Check the internet connection.')); }; document.head.appendChild(s); })); }
  function pdfjs() { return load(PDFJS + 'pdf.min.js').then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; return window.pdfjsLib; }); }
  /* The page's text, row by row (items on the same line joined left to right). */
  function textOf(pdf) {
    var out = [], chain = Promise.resolve();
    for (var n = 1; n <= pdf.numPages; n++) (function (n) {
      chain = chain.then(function () { return pdf.getPage(n); }).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
        var rows = {}; tc.items.forEach(function (it) { var y = Math.round(it.transform[5] / 3) * 3; (rows[y] = rows[y] || []).push([it.transform[4], it.str]); });
        Object.keys(rows).sort(function (a, b) { return b - a; }).forEach(function (y) { out.push(rows[y].sort(function (a, b) { return a[0] - b[0]; }).map(function (x) { return x[1]; }).join(' ')); });
      });
    })(n);
    return chain.then(function () { return out.join('\n'); });
  }
  function ocr(pdf, onStep) {
    return load(TESS).then(function () { return window.Tesseract.createWorker('eng', 1, { langPath: LANG }); }).then(function (w) {
      var text = '', chain = Promise.resolve();
      for (var n = 1; n <= pdf.numPages; n++) (function (n) {
        chain = chain.then(function () { if (onStep) onStep('Reading page ' + n + ' of ' + pdf.numPages + '…'); return pdf.getPage(n); }).then(function (pg) {
          var vp = pg.getViewport({ scale: 2.5 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
          return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise.then(function () { return w.recognize(cv); }).then(function (r) { text += r.data.text + '\n'; });
        });
      })(n);
      return chain.then(function () { return w.terminate(); }).then(function () { return text; });
    });
  }
  /* file (a File or Blob) → Promise of FMSupplierPdf.parse(...) plus { how: 'text' | 'ocr' } */
  function read(file, onStep) {
    return Promise.all([pdfjs(), file.arrayBuffer()]).then(function (got) { return got[0].getDocument({ data: got[1] }).promise; }).then(function (pdf) {
      return textOf(pdf).then(function (t) {
        if (t.replace(/\s/g, '').length > 40) return { text: t, how: 'text' };
        if (onStep) onStep('This PDF is a picture of the page; reading it…');
        return ocr(pdf, onStep).then(function (o) { return { text: o, how: 'ocr' }; });
      });
    }).then(function (r) { var res = window.FMSupplierPdf.parse(r.text); res.how = r.how; return res; });
  }
  window.P2Pdf = { read: read };
})();
