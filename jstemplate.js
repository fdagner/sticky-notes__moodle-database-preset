// URL of an optional background image for the whiteboard (empty = no background)
let imgTemplate = "";

/*
 * Sticky Notes – Whiteboard renderer (Vanilla JS).
 *
 * Draws stored drawings in the list and single view. Drawings are stored as
 * JSON with normalized vector strokes (small payloads, sharp rendering at any
 * size, editable later). Legacy entries with PNG data URLs are still shown
 * as an image.
 *
 * The stroke drawing logic is exported via window.StickyBoard and is also
 * reused by the entry form (addtemplate.html).
 */
(() => {
    'use strict';

    /**
     * Draws a stroke onto the canvas context.
     * Points are stored normalized (0..1); sx/sy are the full buffer dimensions,
     * ls scales the stroke width relative to the reference width (800 px).
     * @param {CanvasRenderingContext2D} context
     * @param {Object} stroke {c: color, w: stroke width, e: eraser, p: [[x,y],...]}
     * @param {number} sx buffer width
     * @param {number} sy buffer height
     * @param {number} ls stroke width scale
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

        // Single point drawn as a round dot
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
     * Draws a JSON drawing into the preview container.
     */
    const drawJson = (view, data, strokes) => {
        const width = view.clientWidth || 280;
        const ratio = (data.w && data.h) ? (data.h / data.w) : 0.5;
        const dpr = window.devicePixelRatio || 1;

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(width * ratio * dpr);
        canvas.style.display = 'block';
        canvas.style.backgroundColor = '#fff'; // drawing surface stays white everywhere
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'Whiteboard drawing');
        view.appendChild(canvas);

        const context = canvas.getContext('2d');
        const scaleX = canvas.width;
        const scaleY = canvas.height;
        const lineWidthScale = canvas.width / (data.w || 800);

        const paint = () => {
            strokes.forEach((stroke) => drawStroke(context, stroke, scaleX, scaleY, lineWidthScale));
        };

        if (data.b) {
            // Legacy raster drawing as background (entries converted once)
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
     * Renders the content of a "Whiteboard" database field inside the card.
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

        // JSON drawing
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

        // Legacy entries: show the PNG data URL as an image
        const match = raw.match(/data:image\/png;base64,[^'"\s]+/);
        if (match) {
            const img = document.createElement('img');
            img.src = match[0];
            img.alt = 'Whiteboard drawing';
            img.className = 'whiteboardcontent';
            view.appendChild(img);
        } else {
            view.style.display = 'none';
        }
    };

    // renderAll: renders all whiteboards – on page load and after the list
    // content has been swapped in by the auto-reload (fetch & swap).
    const renderAll = () => {
        document.querySelectorAll('.whiteboard-raw').forEach(renderBoardData);
    };

    // Shared drawing logic + renderer for the entry form and the auto-reload
    window.StickyBoard = { drawStroke, renderAll };

    document.addEventListener('DOMContentLoaded', renderAll);
})();
