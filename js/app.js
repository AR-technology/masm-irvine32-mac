/**
 * Main Application Controller for MASM + Irvine32 Lab Studio
 */

document.addEventListener('DOMContentLoaded', () => {
    // Instantiate Core Systems
    const cpu = new X86CPU();

    // Terminal Emulator Object for Irvine32
    const consoleOutputEl = document.getElementById('console-output');
    const consoleInputContainer = document.getElementById('console-input-container');
    const consoleInputField = document.getElementById('console-input-field');

    let inputResolver = null;

    const terminal = {
        write: (text) => {
            consoleOutputEl.textContent += text;
            consoleOutputEl.scrollTop = consoleOutputEl.scrollHeight;
        },
        clear: () => {
            consoleOutputEl.textContent = '';
        },
        setColor: (colorCode) => {
            // Map console colors
        },
        readLine: () => {
            return new Promise((resolve) => {
                consoleInputContainer.style.display = 'flex';
                consoleInputField.value = '';
                consoleInputField.focus();
                inputResolver = resolve;
            });
        }
    };

    // Handle interactive stdin from user
    consoleInputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const text = consoleInputField.value;
            consoleInputContainer.style.display = 'none';
            terminal.write(text + '\n');
            if (inputResolver) {
                const res = inputResolver;
                inputResolver = null;
                res(text);
            }
        }
    });

    const irvine = new Irvine32(cpu, terminal);
    const parser = new MasmParser(cpu, irvine);

    // Initialize Editor
    const editorContainer = document.getElementById('editor-container');
    const editor = new CodeEditor(editorContainer, () => {
        setStatus('Ready (Source Modified)');
    });

    // Execution State
    let isRunning = false;
    let isBuilt = false;
    let runSpeedMs = 50; // execution delay in ms when running
    let runTimer = null;

    // UI Elements
    const btnBuild = document.getElementById('btn-build');
    const btnRun = document.getElementById('btn-run');
    const btnStep = document.getElementById('btn-step');
    const btnPause = document.getElementById('btn-pause');
    const btnReset = document.getElementById('btn-reset');
    const btnClearConsole = document.getElementById('btn-clear-console');
    const btnDownload = document.getElementById('btn-download');
    const btnOpenFile = document.getElementById('btn-open-file');
    const fileInput = document.getElementById('file-input');
    const templateSelect = document.getElementById('template-select');
    const speedSelect = document.getElementById('speed-select');
    const statusBadge = document.getElementById('status-badge');
    const buildLogEl = document.getElementById('build-log');

    // Register Hex/Dec Display Toggle
    let viewHex = true;
    const btnToggleHexDec = document.getElementById('btn-toggle-hex-dec');

    // Populate Templates dropdown
    for (const [key, tpl] of Object.entries(LAB_TEMPLATES)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = tpl.name;
        templateSelect.appendChild(opt);
    }

    // Load Default Template
    editor.setValue(LAB_TEMPLATES['default'].code);

    templateSelect.addEventListener('change', (e) => {
        const tpl = LAB_TEMPLATES[e.target.value];
        if (tpl) {
            if (confirm('Load template? Any unsaved changes in the editor will be replaced.')) {
                editor.setValue(tpl.code);
                resetAll();
                terminal.clear();
                terminal.write(`Loaded: ${tpl.name}\n${tpl.description}\n----------------------------------------\n\n`);
            }
        }
    });

    // Speed selection
    speedSelect.addEventListener('change', (e) => {
        runSpeedMs = parseInt(e.target.value, 10);
    });

    // Hex / Dec Toggle
    btnToggleHexDec.addEventListener('click', () => {
        viewHex = !viewHex;
        btnToggleHexDec.textContent = viewHex ? 'Mode: Hex' : 'Mode: Dec';
        updateRegistersUI();
    });

    // Set Status Message
    function setStatus(text, type = 'normal') {
        statusBadge.textContent = text;
        statusBadge.className = `status-badge ${type}`;
    }

    // Build (Assemble) Source Code
    function buildProject() {
        terminal.clear();
        buildLogEl.textContent = 'Assembling and linking project...\n';
        editor.setErrorLines([]);

        const code = editor.getValue();
        const result = parser.assemble(code);

        if (result.success) {
            isBuilt = true;
            buildLogEl.textContent += `✓ Build succeeded.\n- Instructions: ${result.instructionsCount}\n- Data Variables: ${result.dataSymbols.length}\nReady to Run (F5) or Step (F10).\n`;
            setStatus('Build Succeeded', 'success');
            
            // Set active line to first instruction
            if (parser.instructions.length > 0) {
                const firstInst = parser.instructions[0];
                editor.setActiveLine(firstInst.lineNum);
            }
            updateAllPanels();
            return true;
        } else {
            isBuilt = false;
            buildLogEl.textContent += `✕ Build failed with ${result.errors.length} error(s):\n`;
            const errorLines = [];
            for (const err of result.errors) {
                buildLogEl.textContent += `  Line ${err.line}: ${err.message} -> "${err.text}"\n`;
                errorLines.push(err.line);
            }
            editor.setErrorLines(errorLines);
            setStatus('Build Failed', 'error');
            // Switch to build log tab if error
            showTab('tab-build');
            return false;
        }
    }

    // Step a single instruction (F10)
    async function stepInstruction() {
        if (!isBuilt) {
            if (!buildProject()) return;
        }

        if (cpu.isHalted) {
            setStatus(`Program Exited (Code: ${cpu.exitCode})`, 'normal');
            editor.clearActiveLine();
            return;
        }

        setStatus('Executing...', 'running');
        try {
            const stepResult = await parser.step();

            updateAllPanels();

            if (stepResult.halted) {
                editor.clearActiveLine();
                setStatus(`Execution Finished (Exit Code ${cpu.exitCode})`, 'success');
                buildLogEl.textContent += `\n[Program terminated with return code ${cpu.exitCode}]\n`;
            } else {
                // Find next line to highlight
                const nextInstIdx = Math.floor((cpu.regs.EIP - parser.codeBase) / 4);
                if (nextInstIdx >= 0 && nextInstIdx < parser.instructions.length) {
                    const nextInst = parser.instructions[nextInstIdx];
                    editor.setActiveLine(nextInst.lineNum);
                } else {
                    editor.clearActiveLine();
                }
                setStatus('Paused at instruction', 'normal');
            }
        } catch (err) {
            setStatus('Runtime Exception', 'error');
            buildLogEl.textContent += `\nRuntime Exception: ${err.message}\n`;
            showTab('tab-build');
            editor.clearActiveLine();
            cpu.isHalted = true;
        }
    }

    // Run execution loop (F5)
    async function runProject() {
        if (!isBuilt) {
            if (!buildProject()) return;
        }

        if (cpu.isHalted) {
            resetAll();
            buildProject();
        }

        isRunning = true;
        btnRun.disabled = true;
        btnStep.disabled = true;
        btnPause.disabled = false;
        setStatus('Running...', 'running');

        async function loop() {
            if (!isRunning || cpu.isHalted) {
                stopRunning();
                return;
            }

            // Check if current line has a breakpoint
            const curInstIdx = Math.floor((cpu.regs.EIP - parser.codeBase) / 4);
            if (curInstIdx >= 0 && curInstIdx < parser.instructions.length) {
                const curInst = parser.instructions[curInstIdx];
                // If hitting breakpoint on a line we didn't just step from
                if (editor.hasBreakpoint(curInst.lineNum) && cpu.instructionCount > 0) {
                    stopRunning();
                    editor.setActiveLine(curInst.lineNum);
                    setStatus(`Hit Breakpoint at line ${curInst.lineNum}`, 'warning');
                    return;
                }
            }

            try {
                const res = await parser.step();
                updateAllPanels();

                if (res.halted) {
                    stopRunning();
                    editor.clearActiveLine();
                    setStatus(`Program Finished (Code: ${cpu.exitCode})`, 'success');
                    return;
                }

                const nextInstIdx = Math.floor((cpu.regs.EIP - parser.codeBase) / 4);
                if (nextInstIdx >= 0 && nextInstIdx < parser.instructions.length) {
                    editor.setActiveLine(parser.instructions[nextInstIdx].lineNum);
                }

                if (runSpeedMs > 0) {
                    runTimer = setTimeout(loop, runSpeedMs);
                } else {
                    // Maximum speed without UI lock
                    if (cpu.instructionCount % 20 === 0) {
                        setTimeout(loop, 0);
                    } else {
                        loop();
                    }
                }
            } catch (err) {
                stopRunning();
                setStatus('Runtime Error', 'error');
                buildLogEl.textContent += `\nRuntime Error: ${err.message}\n`;
                showTab('tab-build');
                cpu.isHalted = true;
            }
        }

        loop();
    }

    function pauseExecution() {
        stopRunning();
        setStatus('Execution Paused', 'normal');
    }

    function stopRunning() {
        isRunning = false;
        if (runTimer) clearTimeout(runTimer);
        btnRun.disabled = false;
        btnStep.disabled = false;
        btnPause.disabled = true;
    }

    function resetAll() {
        stopRunning();
        cpu.reset();
        parser.reset();
        isBuilt = false;
        editor.clearActiveLine();
        editor.setErrorLines([]);
        setStatus('Ready');
        updateAllPanels();
    }

    // Update UI Panels
    function updateAllPanels() {
        updateRegistersUI();
        updateFlagsUI();
        updateMemoryUI();
        updateStackUI();
    }

    function formatVal(val, size = 4) {
        if (viewHex) {
            if (size === 1) return (val & 0xFF).toString(16).toUpperCase().padStart(2, '0') + 'h';
            if (size === 2) return (val & 0xFFFF).toString(16).toUpperCase().padStart(4, '0') + 'h';
            return (val >>> 0).toString(16).toUpperCase().padStart(8, '0') + 'h';
        } else {
            return (val | 0).toString();
        }
    }

    function updateRegistersUI() {
        const regs = ['EAX', 'EBX', 'ECX', 'EDX', 'ESI', 'EDI', 'EBP', 'ESP', 'EIP'];
        for (const r of regs) {
            const valEl = document.getElementById(`reg-${r.toLowerCase()}`);
            const cellEl = document.getElementById(`cell-${r.toLowerCase()}`);
            if (valEl) {
                valEl.textContent = formatVal(cpu.regs[r], 4);
            }
            if (cellEl) {
                if (cpu.changedRegs.has(r)) {
                    cellEl.classList.add('changed');
                } else {
                    cellEl.classList.remove('changed');
                }
            }
        }
    }

    function updateFlagsUI() {
        const flags = ['CF', 'ZF', 'SF', 'OF', 'PF', 'AF'];
        for (const f of flags) {
            const flagEl = document.getElementById(`flag-${f.toLowerCase()}`);
            if (flagEl) {
                flagEl.textContent = cpu.flags[f];
                if (cpu.changedFlags.has(f)) {
                    flagEl.classList.add('changed');
                } else {
                    flagEl.classList.remove('changed');
                }
            }
        }
    }

    function updateMemoryUI() {
        const memTableBody = document.getElementById('data-variables-body');
        if (!memTableBody) return;

        let html = '';
        if (parser.dataSymbols.length === 0) {
            html = `<tr><td colspan="5" style="text-align:center; color:#888;">No .data variables defined</td></tr>`;
        } else {
            for (const sym of parser.dataSymbols) {
                const curVal = cpu.readMem(sym.address, sym.elemSize);
                let hexRep = (curVal >>> 0).toString(16).toUpperCase().padStart(sym.elemSize * 2, '0') + 'h';
                let decRep = (curVal | 0).toString();

                // ASCII interpretation if BYTE
                let asciiRep = '';
                for (let i = 0; i < sym.size; i++) {
                    const b = cpu.readByte(sym.address + i);
                    asciiRep += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
                }

                html += `
                    <tr>
                        <td class="symbol-name">${sym.name}</td>
                        <td class="symbol-type">${sym.type}</td>
                        <td class="symbol-addr">0x${sym.address.toString(16).toUpperCase()}</td>
                        <td class="symbol-val">${viewHex ? hexRep : decRep}</td>
                        <td class="symbol-ascii">${asciiRep}</td>
                    </tr>
                `;
            }
        }
        memTableBody.innerHTML = html;
    }

    function updateStackUI() {
        const stackList = document.getElementById('stack-list');
        if (!stackList) return;

        let html = '';
        const baseStack = 0x0012FFF0;
        const curEsp = cpu.regs.ESP;

        if (curEsp >= baseStack) {
            html = `<div class="stack-item empty">Stack is empty</div>`;
        } else {
            for (let addr = curEsp; addr <= Math.min(curEsp + 32, baseStack); addr += 4) {
                const val = cpu.readDword(addr);
                const isEsp = addr === curEsp ? ' <span class="esp-tag">← ESP</span>' : '';
                html += `
                    <div class="stack-item ${addr === curEsp ? 'at-esp' : ''}">
                        <span class="stack-addr">0x${addr.toString(16).toUpperCase()}</span>
                        <span class="stack-val">${(val >>> 0).toString(16).toUpperCase().padStart(8, '0')}h</span>
                        ${isEsp}
                    </div>
                `;
            }
        }
        stackList.innerHTML = html;
    }

    // Tab navigation (Terminal vs Build Log)
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.tab;
            showTab(targetId);
        });
    });

    function showTab(tabId) {
        tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
        tabPanes.forEach(p => p.classList.toggle('active', p.id === tabId));
    }

    // Action Buttons
    btnBuild.addEventListener('click', buildProject);
    btnRun.addEventListener('click', runProject);
    btnStep.addEventListener('click', stepInstruction);
    btnPause.addEventListener('click', pauseExecution);
    btnReset.addEventListener('click', resetAll);
    btnClearConsole.addEventListener('click', () => terminal.clear());

    // File Save / Download main.asm
    btnDownload.addEventListener('click', () => {
        const code = editor.getValue();
        const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'main.asm';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // File Open
    btnOpenFile.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                editor.setValue(evt.target.result);
                resetAll();
                terminal.clear();
                terminal.write(`Opened file: ${file.name}\n\n`);
            };
            reader.readAsText(file);
        }
    });

    // Keyboard Shortcuts (Visual Studio style)
    window.addEventListener('keydown', (e) => {
        // F5 -> Run / Continue
        if (e.key === 'F5') {
            e.preventDefault();
            if (isRunning) pauseExecution();
            else runProject();
        }
        // F10 or F11 -> Step
        else if (e.key === 'F10' || e.key === 'F11') {
            e.preventDefault();
            stepInstruction();
        }
        // F7 or Ctrl+B / Cmd+B -> Build
        else if (e.key === 'F7' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b')) {
            e.preventDefault();
            buildProject();
        }
        // Shift+F5 -> Stop / Reset
        else if (e.shiftKey && e.key === 'F5') {
            e.preventDefault();
            resetAll();
        }
    });

    // Initial draw
    updateAllPanels();
    setStatus('Ready to Code');

    // ---------------------------------------------------------
    // Offline AI Assistant (MASM ⇄ TASM) Controller
    // ---------------------------------------------------------
    const btnAiAssistant = document.getElementById('btn-ai-assistant');
    const aiModal = document.getElementById('ai-modal');
    const btnCloseAi = document.getElementById('btn-close-ai');
    const aiPromptInput = document.getElementById('ai-prompt-input');
    const btnAiSubmit = document.getElementById('btn-ai-submit');
    const aiExamplesContainer = document.getElementById('ai-examples');
    const aiResultContainer = document.getElementById('ai-result-container');
    const aiResultTitle = document.getElementById('ai-result-title');
    const aiResultDesc = document.getElementById('ai-result-desc');
    const aiCodeMasm = document.getElementById('ai-code-masm');
    const aiCodeTasm = document.getElementById('ai-code-tasm');
    const aiDiffList = document.getElementById('ai-diff-list');
    const btnAiLoadEditor = document.getElementById('btn-ai-load-editor');
    const btnAiCopyMasm = document.getElementById('btn-ai-copy-masm');
    const btnAiCopyTasm = document.getElementById('btn-ai-copy-tasm');

    let currentAiResult = null;

    if (btnAiAssistant && aiModal && window.AssemblyAI) {
        // Populate Example Prompts
        const samplePrompts = [
            "Add two numbers 25 and 40",
            "Check if number is even or odd",
            "Find largest of three numbers",
            "Calculate array sum and average",
            "Reverse a string",
            "Bubble sort array",
            "Factorial of 5",
            "Print numbers 1 to 10",
            "Linear search in array",
            "Star pattern 5 rows"
        ];

        samplePrompts.forEach(promptText => {
            const pill = document.createElement('button');
            pill.className = 'example-pill';
            pill.textContent = promptText;
            pill.addEventListener('click', () => {
                aiPromptInput.value = promptText;
                triggerAiGeneration();
            });
            aiExamplesContainer.appendChild(pill);
        });

        // Open / Close modal
        btnAiAssistant.addEventListener('click', () => {
            aiModal.style.display = 'flex';
            aiPromptInput.focus();
        });

        btnCloseAi.addEventListener('click', () => {
            aiModal.style.display = 'none';
        });

        aiModal.addEventListener('click', (e) => {
            if (e.target === aiModal) aiModal.style.display = 'none';
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && aiModal.style.display === 'flex') {
                aiModal.style.display = 'none';
            }
        });

        // Submit Prompt
        function triggerAiGeneration() {
            const prompt = aiPromptInput.value.trim();
            if (!prompt) return;

            try {
                const res = window.AssemblyAI.generate(prompt);
                currentAiResult = res;

                aiResultTitle.textContent = res.title;
                aiResultDesc.textContent = res.analysis;
                aiCodeMasm.textContent = res.masm;
                aiCodeTasm.textContent = res.tasm;

                // Differences
                aiDiffList.innerHTML = '';
                if (res.differences && res.differences.length > 0) {
                    res.differences.forEach(diff => {
                        const li = document.createElement('li');
                        li.textContent = diff;
                        aiDiffList.appendChild(li);
                    });
                }

                aiResultContainer.style.display = 'block';
            } catch (err) {
                alert('Error generating code: ' + err.message);
            }
        }

        btnAiSubmit.addEventListener('click', triggerAiGeneration);
        aiPromptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerAiGeneration();
            }
        });

        // Tab Switching in AI Modal
        const aiTabs = document.querySelectorAll('.ai-tab');
        const aiPanes = document.querySelectorAll('.ai-tab-pane');
        aiTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                aiTabs.forEach(t => t.classList.remove('active'));
                aiPanes.forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const targetId = tab.getAttribute('data-tab');
                const targetPane = document.getElementById(targetId);
                if (targetPane) targetPane.classList.add('active');
            });
        });

        // Load into Web Editor
        btnAiLoadEditor.addEventListener('click', () => {
            if (currentAiResult && currentAiResult.masm) {
                editor.setValue(currentAiResult.masm);
                resetAll();
                aiModal.style.display = 'none';
                setStatus('Loaded AI MASM Code');
                terminal.clear();
                terminal.write(`[AI Assistant] Loaded "${currentAiResult.title}" into main.asm\nPress F5 (Run) or F10 (Step) to execute.\n\n`);
            }
        });

        // Copy buttons
        btnAiCopyMasm.addEventListener('click', () => {
            if (currentAiResult) {
                navigator.clipboard.writeText(currentAiResult.masm).then(() => {
                    btnAiCopyMasm.textContent = '✓ Copied!';
                    setTimeout(() => { btnAiCopyMasm.textContent = '📋 Copy MASM'; }, 2000);
                });
            }
        });

        btnAiCopyTasm.addEventListener('click', () => {
            if (currentAiResult) {
                navigator.clipboard.writeText(currentAiResult.tasm).then(() => {
                    btnAiCopyTasm.textContent = '✓ Copied!';
                    setTimeout(() => { btnAiCopyTasm.textContent = '📋 Copy TASM'; }, 2000);
                });
            }
        });

        // Auto-Fix TASM Button in AI Modal
        const btnAiFixTasm = document.getElementById('btn-ai-fix-tasm');
        if (btnAiFixTasm) {
            btnAiFixTasm.addEventListener('click', () => {
                if (currentAiResult && currentAiResult.tasm) {
                    const fixed = window.AssemblyAI.fixTasm(currentAiResult.tasm);
                    currentAiResult.tasm = fixed;
                    aiCodeTasm.textContent = fixed;
                    navigator.clipboard.writeText(fixed).then(() => {
                        btnAiFixTasm.textContent = '✓ Fixed & Copied!';
                        setTimeout(() => { btnAiFixTasm.textContent = '🔧 Fix PrintNum / EOF'; }, 2000);
                    });
                }
            });
        }
    }

    // ---------------------------------------------------------
    // Toolbar: Fix TASM Code Modal Controller
    // ---------------------------------------------------------
    const btnFixTasmCode = document.getElementById('btn-fix-tasm-code');
    const fixModal = document.getElementById('fix-modal');
    const btnCloseFix = document.getElementById('btn-close-fix');
    const fixCodeInput = document.getElementById('fix-code-input');
    const btnRunFix = document.getElementById('btn-run-fix');
    const fixStatus = document.getElementById('fix-status');

    if (btnFixTasmCode && fixModal) {
        btnFixTasmCode.addEventListener('click', () => {
            fixModal.style.display = 'flex';
            fixStatus.style.display = 'none';
            // Pre-fill with editor content if it contains TASM code
            const currentCode = editor.getValue();
            if (currentCode.includes('.model small') || currentCode.includes('PrintNum')) {
                fixCodeInput.value = currentCode;
            } else {
                fixCodeInput.value = '';
            }
            fixCodeInput.focus();
        });

        btnCloseFix.addEventListener('click', () => {
            fixModal.style.display = 'none';
        });

        fixModal.addEventListener('click', (e) => {
            if (e.target === fixModal) fixModal.style.display = 'none';
        });

        btnRunFix.addEventListener('click', () => {
            const raw = fixCodeInput.value.trim();
            if (!raw) return;

            const fixed = window.AssemblyAI.fixTasm(raw);
            fixCodeInput.value = fixed;
            navigator.clipboard.writeText(fixed).then(() => {
                fixStatus.textContent = '✓ Fixed! Replaced PrintNum with self-contained printing and copied to clipboard.';
                fixStatus.style.display = 'block';
                btnRunFix.textContent = '✓ Copied to Clipboard!';
                setTimeout(() => { btnRunFix.textContent = '🔧 Fix & Copy Code'; }, 2000);
            });
        });
    }
});
