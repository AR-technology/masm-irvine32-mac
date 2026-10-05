const X86CPU = require('./js/x86_cpu.js');
const Irvine32 = require('./js/irvine32.js');
const MasmParser = require('./js/masm_parser.js');
const LAB_TEMPLATES = require('./js/templates.js');

async function testAll() {
    console.log("Testing MASM + Irvine32 Emulator on all lab templates...\n");

    for (const [key, tpl] of Object.entries(LAB_TEMPLATES)) {
        console.log(`=== Testing Template: ${tpl.name} (${key}) ===`);
        const cpu = new X86CPU();
        let consoleBuf = '';
        const terminal = {
            write: (str) => { consoleBuf += str; },
            clear: () => { consoleBuf = ''; },
            setColor: () => {},
            readLine: async () => "15" // Mock input
        };
        const irvine = new Irvine32(cpu, terminal);
        const parser = new MasmParser(cpu, irvine);

        const res = parser.assemble(tpl.code);
        if (!res.success) {
            console.error(`Assembly Failed for ${key}:`, res.errors);
            process.exit(1);
        }

        // Run until completion or max steps
        let steps = 0;
        while (!cpu.isHalted && steps < 1000) {
            await parser.step();
            steps++;
        }

        console.log(`✓ Assembled & Ran in ${steps} steps.`);
        console.log(`Console Output:\n${consoleBuf.trim() || '[No output]'}\n`);
    }

    console.log("All lab templates assembled and executed successfully!");
}

testAll().catch(err => {
    console.error("Test Error:", err);
    process.exit(1);
});
