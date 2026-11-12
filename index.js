const { extensionSettings, saveSettingsDebounced, eventSource, event_types } = SillyTavern.getContext();

const MODULE = 'floating_notes';
const DEFAULTS = { open: false, x: 80, y: 120, w: 320, h: 240, text: '' };

function getSettings() {
    extensionSettings[MODULE] = Object.assign({}, DEFAULTS, extensionSettings[MODULE]);
    return extensionSettings[MODULE];
}

function clampToViewport(win, settings) {
    const maxX = Math.max(0, window.innerWidth - 60);
    const maxY = Math.max(0, window.innerHeight - 40);
    settings.x = Math.min(Math.max(0, settings.x), maxX);
    settings.y = Math.min(Math.max(0, settings.y), maxY);
    win.style.left = `${settings.x}px`;
    win.style.top = `${settings.y}px`;
}

function setOpen(win, open) {
    const settings = getSettings();
    settings.open = open;
    win.classList.toggle('fn-open', open);
    if (open) clampToViewport(win, settings);
    saveSettingsDebounced();
}

function makeDraggable(win, handle) {
    const settings = getSettings();
    let startX, startY, originX, originY;

    handle.addEventListener('pointerdown', (e) => {
        startX = e.clientX;
        startY = e.clientY;
        originX = settings.x;
        originY = settings.y;
        handle.setPointerCapture(e.pointerId);
        win.classList.add('fn-dragging');
        e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
        if (!handle.hasPointerCapture(e.pointerId)) return;
        settings.x = originX + (e.clientX - startX);
        settings.y = originY + (e.clientY - startY);
        clampToViewport(win, settings);
    });

    const end = (e) => {
        if (!handle.hasPointerCapture(e.pointerId)) return;
        handle.releasePointerCapture(e.pointerId);
        win.classList.remove('fn-dragging');
        saveSettingsDebounced();
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
}

eventSource.on(event_types.APP_INITIALIZED, () => {
    const settings = getSettings();

    // Build the window
    const win = document.createElement('div');
    win.id = 'floating_notes_window';
    win.innerHTML = `
        <div class="fn-bar">
            <div class="fn-handle fa-solid fa-up-down-left-right" title="Drag to move"></div>
            <div class="fn-close fa-solid fa-xmark" title="Close"></div>
        </div>
        <textarea placeholder="Notes..."></textarea>
    `;
    document.body.appendChild(win);

    const textarea = win.querySelector('textarea');
    const handle = win.querySelector('.fn-handle');

    // Restore saved state
    win.style.width = `${settings.w}px`;
    win.style.height = `${settings.h}px`;
    textarea.value = settings.text;
    clampToViewport(win, settings);
    win.classList.toggle('fn-open', settings.open);

    // Save notes as you type
    textarea.addEventListener('input', () => {
        settings.text = textarea.value;
        saveSettingsDebounced();
    });

    // Save size when resized (ignore while hidden, where size reads as 0)
    new ResizeObserver(() => {
        if (!win.classList.contains('fn-open')) return;
        settings.w = win.offsetWidth;
        settings.h = win.offsetHeight;
        saveSettingsDebounced();
    }).observe(win);

    // Keep it on-screen if the browser window shrinks
    window.addEventListener('resize', () => clampToViewport(win, settings));

    makeDraggable(win, handle);
    win.querySelector('.fn-close').addEventListener('click', () => setOpen(win, false));

    const toggle = () => setOpen(win, !win.classList.contains('fn-open'));

    // Note button on the left side of the message bar (next to the menu and wand icons)
    const button = $(`<div id="floating_notes_button" class="fa-solid fa-note-sticky interactable" title="Floating Notes" tabindex="0"></div>`);
    button.on('click', toggle);
    button.on('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    });

    if ($('#leftSendForm').length) {
        $('#leftSendForm').append(button);
    } else {
        // Fallback for heavily modified themes: put it in the wand menu instead
        const item = $(`
            <div id="floating_notes_toggle" class="list-group-item flex-container flexGap5">
                <div class="fa-solid fa-note-sticky extensionsMenuExtensionButton"></div>
                Floating Notes
            </div>
        `);
        item.on('click', toggle);
        $('#extensionsMenu').append(item);
    }
});
