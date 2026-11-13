// URL zu einem optionalen Hintergrundbild für das Whiteboard (leer = kein Hintergrund)
let imgTemplate = "";

/*
 * Sticky Notes – Whiteboard-Renderer (Vanilla JS).
 *
 * Zeichnet gespeicherte Zeichnungen in der Listen- und Einzelansicht.
 * Zeichnungen werden als JSON mit normalisierten Vektor-Strichen gespeichert
 * (kleine Datenmengen, scharfes Rendering in jeder Größe, später weiterbearbeitbar).
 * Ältere Einträge mit PNG-Data-URL werden weiterhin als Bild angezeigt.
 *
 * Die Strich-Zeichenlogik wird über window.StickyBoard.exportiert und auch vom
 * Eintragsformular (addtemplate.html) wiederverwendet.
 */
(() => {
    'use strict';

    /**
     * Zeichnet einen Strich in den Canvas-Kontext.
     * Punkte sind normalisiert (0..1) gespeichert; sx/sy sind die vollen Buffer-Maße,
     * ls skaliert die Strichstärke relativ zur Referenzbreite (800 px).
     * @param {CanvasRenderingContext2D} context
     * @param {Object} stroke {c: Farbe, w: Strichstärke, e: Radierer, p: [[x,y],...]}
     * @param {number} sx Buffer-Breite
     * @param {number} sy Buffer-Höhe
     * @param {number} ls Strichstärken-Skalierung
     */
    const drawStroke = (context, stroke, sx, sy, ls) => {
        const points = stroke.p || [];
        if (points.length === 0) {
            return;
        }

        context.globalCompositeOperation = stroke.e ? 'destination-out' : 'source-over';
        context.lineJoin = 'round';
        context.lineCap = 'round';

        const x = points[0][0] * sx;
        const y = points[0][1] * sy;

        // Einzelpunkt als runder Punkt zeichnen
        if (points.length === 1) {
            context.beginPath();
            context.arc(x, y, Math.max(0.5, (stroke.w || 4) * ls / 2), 0, Math.PI * 2);
            if (!stroke.e) {
                context.fillStyle = stroke.c || '#000000';
            }
            context.fill();
        } else {
            context.beginPath();
            context.lineWidth = Math.max(1, (stroke.w || 4) * ls);
            if (!stroke.e) {
                context.strokeStyle = stroke.c || '#000000';
            }
            context.moveTo(x, y);
            for (let i = 1; i < points.length; i++) {
                context.lineTo(points[i][0] * sx, points[i][1] * sy);
            }
            context.stroke();
        }

        context.globalCompositeOperation = 'source-over';
    };

    /**
     * Zeichnet eine JSON-Zeichnung in den Vorschau-Container.
     */
    const drawJson = (view, data, strokes) => {
        const width = view.clientWidth || 280;
        const ratio = (data.w && data.h) ? (data.h / data.w) : 0.5;
        const dpr = window.devicePixelRatio || 1;

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(width * ratio * dpr);
        canvas.style.display = 'block';
        canvas.style.backgroundColor = '#fff'; // Zeichenfläche überall einheitlich weiß
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Whiteboard-Zeichnung');
        view.appendChild(canvas);

        const context = canvas.getContext('2d');
        const scaleX = canvas.width;
        const scaleY = canvas.height;
        const lineWidthScale = canvas.width / (data.w || 800);

        const paint = () => {
            strokes.forEach((stroke) => drawStroke(context, stroke, scaleX, scaleY, lineWidthScale));
        };

        if (data.b) {
            // Ältere Raster-Zeichnung als Untergrund (einmalig konvertierte Einträge)
            const base = new Image();
            base.onload = () => {
                context.drawImage(base, 0, 0, canvas.width, canvas.height);
                paint();
            };
            base.src = data.b;
        } else {
            paint();
        }
    };

    /**
     * Rendert den Inhalt eines Datenbankfelds "Whiteboard" in der Karte.
     */
    const renderBoardData = (holder) => {
        const view = holder.parentElement.querySelector('.dataurlview');
        if (!view) {
            return;
        }

        const raw = (holder.textContent || '').trim();
        if (!raw) {
            view.style.display = 'none';
            return;
        }

        // JSON-Zeichnung
        if (raw.charAt(0) === '{') {
            let data;
            try {
                data = JSON.parse(raw);
            } catch {
                view.style.display = 'none';
                return;
            }
            const strokes = data.s || [];
            if (strokes.length === 0 && !data.b) {
                view.style.display = 'none';
                return;
            }
            drawJson(view, data, strokes);
            return;
        }

        // Ältere Einträge: PNG-Data-URL als Bild anzeigen
        const match = raw.match(/data:image\/png;base64,[^'"\s]+/);
        if (match) {
            const img = document.createElement('img');
            img.src = match[0];
            img.alt = 'Whiteboard-Zeichnung';
            img.className = 'whiteboardcontent';
            view.appendChild(img);
        } else {
            view.style.display = 'none';
        }
    };

    // renderAll: rendert alle Whiteboards – beim Laden und nach dem dynamischen
    // Austausch des Listeninhalts durch die Auto-Aktualisierung (fetch & swap).
    const renderAll = () => {
        document.querySelectorAll('.whiteboard-raw').forEach(renderBoardData);
    };

    // Gemeinsame Zeichenlogik + Renderer für Formular und Auto-Aktualisierung
    window.StickyBoard = { drawStroke, renderAll };

    document.addEventListener('DOMContentLoaded', renderAll);
})();
