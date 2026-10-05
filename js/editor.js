/**
 * Assembly Code Editor with Line Numbers, Breakpoints, and Active Line Highlighting
 */

class CodeEditor {
    constructor(containerEl, onChange) {
        this.container = containerEl;
        this.onChange = onChange;
        this.breakpoints = new Set(); // Set of line numbers (1-indexed)
        this.activeLine = null;       // Currently executing line number
        this.errorLines = new Set();  // Set of error line numbers

        this.initDOM();
    }

    initDOM() {
        this.container.innerHTML = `
            <div class="editor-wrapper">
                <div class="gutter" id="editor-gutter"></div>
                <div class="editor-area">
                    <textarea id="code-input" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"></textarea>
                </div>
            </div>
        `;

        this.textarea = this.container.querySelector('#code-input');
        this.gutter = this.container.querySelector('#editor-gutter');

        this.bindEvents();
        this.updateLineNumbers();
    }

    bindEvents() {
        // Handle input change
        this.textarea.addEventListener('input', () => {
            this.updateLineNumbers();
            if (this.onChange) this.onChange(this.getValue());
        });

        // Sync scroll between textarea and gutter
        this.textarea.addEventListener('scroll', () => {
            this.gutter.scrollTop = this.textarea.scrollTop;
        });

        // Handle Tab key for proper 4-space indentation
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = this.textarea.selectionStart;
                const end = this.textarea.selectionEnd;
                const val = this.textarea.value;
                this.textarea.value = val.substring(0, start) + "    " + val.substring(end);
                this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
                this.updateLineNumbers();
                if (this.onChange) this.onChange(this.getValue());
            }
        });

        // Gutter click for breakpoints
        this.gutter.addEventListener('click', (e) => {
            const lineEl = e.target.closest('.gutter-line');
            if (lineEl) {
                const lineNum = parseInt(lineEl.dataset.line, 10);
                this.toggleBreakpoint(lineNum);
            }
        });
    }

    getValue() {
        return this.textarea.value;
    }

    setValue(val) {
        this.textarea.value = val;
        this.updateLineNumbers();
        if (this.onChange) this.onChange(val);
    }

    toggleBreakpoint(lineNum) {
        if (this.breakpoints.has(lineNum)) {
            this.breakpoints.delete(lineNum);
        } else {
            this.breakpoints.add(lineNum);
        }
        this.updateLineNumbers();
    }

    hasBreakpoint(lineNum) {
        return this.breakpoints.has(lineNum);
    }

    setActiveLine(lineNum) {
        this.activeLine = lineNum;
        this.updateLineNumbers();
        this.scrollToLine(lineNum);
    }

    clearActiveLine() {
        this.activeLine = null;
        this.updateLineNumbers();
    }

    setErrorLines(lines) {
        this.errorLines = new Set(lines);
        this.updateLineNumbers();
    }

    scrollToLine(lineNum) {
        if (!lineNum) return;
        const totalLines = this.textarea.value.split('\n').length;
        const lineHeight = 21; // approximate px height per line
        const targetScroll = (lineNum - 3) * lineHeight;
        if (targetScroll > 0) {
            this.textarea.scrollTop = targetScroll;
            this.gutter.scrollTop = targetScroll;
        }
    }

    updateLineNumbers() {
        const lines = this.textarea.value.split('\n');
        let html = '';

        for (let i = 1; i <= lines.length; i++) {
            const hasBp = this.breakpoints.has(i) ? 'has-bp' : '';
            const isActive = this.activeLine === i ? 'is-active' : '';
            const isError = this.errorLines.has(i) ? 'is-error' : '';

            html += `
                <div class="gutter-line ${hasBp} ${isActive} ${isError}" data-line="${i}">
                    <span class="bp-icon">●</span>
                    <span class="active-arrow">▶</span>
                    <span class="line-num">${i}</span>
                </div>
            `;
        }
        this.gutter.innerHTML = html;
    }
}
