/**
 * Irvine32 Library Procedures Emulation
 * Matches Kip Irvine's "Assembly Language for x86 Processors" library
 */

class Irvine32 {
    constructor(cpu, terminal) {
        this.cpu = cpu;
        this.terminal = terminal; // Object with write(str), readLine(prompt, callback), clear()
        this.rngSeed = Date.now();
    }

    // Hex formatting helper
    toHex32(val) {
        return (val >>> 0).toString(16).toUpperCase().padStart(8, '0');
    }

    toHex16(val) {
        return (val & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    }

    toHex8(val) {
        return (val & 0xFF).toString(16).toUpperCase().padStart(2, '0');
    }

    toBin32(val) {
        return (val >>> 0).toString(2).padStart(32, '0').match(/.{1,4}/g).join(' ');
    }

    // Procedure implementations
    async executeProcedure(name) {
        const proc = name.toUpperCase();
        switch (proc) {
            case 'DUMPREGS':
                this.DumpRegs();
                break;
            case 'DUMPMEM':
                this.DumpMem();
                break;
            case 'WRITESTRING':
                this.WriteString();
                break;
            case 'WRITEINT':
                this.WriteInt();
                break;
            case 'WRITEDEC':
                this.WriteDec();
                break;
            case 'WRITEHEX':
                this.WriteHex();
                break;
            case 'WRITEBIN':
                this.WriteBin();
                break;
            case 'WRITECHAR':
                this.WriteChar();
                break;
            case 'CRLF':
                this.Crlf();
                break;
            case 'CLRSCR':
                this.Clrscr();
                break;
            case 'READINT':
                await this.ReadInt();
                break;
            case 'READDEC':
                await this.ReadDec();
                break;
            case 'READHEX':
                await this.ReadHex();
                break;
            case 'READCHAR':
                await this.ReadChar();
                break;
            case 'READSTRING':
                await this.ReadString();
                break;
            case 'RANDOMIZE':
                this.Randomize();
                break;
            case 'RANDOMRANGE':
                this.RandomRange();
                break;
            case 'RANDOM32':
                this.Random32();
                break;
            case 'WAITMSG':
                await this.WaitMsg();
                break;
            case 'DELAY':
                await this.Delay();
                break;
            case 'SETTEXTCOLOR':
                this.SetTextColor();
                break;
            case 'GOTOXY':
                this.Gotoxy();
                break;
            case 'STRLENGTH':
                this.StrLength();
                break;
            case 'STRCOPY':
                this.StrCopy();
                break;
            case 'STRCOMPARE':
                this.StrCompare();
                break;
            default:
                throw new Error(`Irvine32 procedure not implemented or unknown: ${name}`);
        }
    }

    // Exact Irvine32 textbook DumpRegs format
    DumpRegs() {
        const r = this.cpu.regs;
        const f = this.cpu.flags;
        const efl = this.toHex32(this.cpu.getEFlagsDword());

        const line1 = `  EAX=${this.toHex32(r.EAX)}  EBX=${this.toHex32(r.EBX)}  ECX=${this.toHex32(r.ECX)}  EDX=${this.toHex32(r.EDX)}`;
        const line2 = `  ESI=${this.toHex32(r.ESI)}  EDI=${this.toHex32(r.EDI)}  EBP=${this.toHex32(r.EBP)}  ESP=${this.toHex32(r.ESP)}`;
        const line3 = `  EIP=${this.toHex32(r.EIP)}  EFL=${efl}  CF=${f.CF}  SF=${f.SF}  ZF=${f.ZF}  OF=${f.OF}  AF=${f.AF}  PF=${f.PF}`;

        this.terminal.write(`${line1}\n${line2}\n${line3}\n\n`);
    }

    // Dump memory range at ESI, count in ECX, element size in EBX (1=byte, 2=word, 4=dword)
    DumpMem() {
        const addr = this.cpu.regs.ESI;
        const count = this.cpu.regs.ECX;
        const unitSize = this.cpu.regs.EBX || 1;

        this.terminal.write(`Dump of offset ${this.toHex32(addr)}\n-------------------------------\n`);
        let out = '';
        for (let i = 0; i < count; i++) {
            const curAddr = addr + (i * unitSize);
            if (unitSize === 1) {
                out += this.toHex8(this.cpu.readByte(curAddr)) + ' ';
            } else if (unitSize === 2) {
                out += this.toHex16(this.cpu.readWord(curAddr)) + ' ';
            } else if (unitSize === 4) {
                out += this.toHex32(this.cpu.readDword(curAddr)) + ' ';
            }
            if ((i + 1) % 16 === 0) out += '\n';
        }
        this.terminal.write(out + '\n\n');
    }

    // Writes null-terminated string pointed by EDX
    WriteString() {
        let addr = this.cpu.regs.EDX;
        let str = '';
        let maxLen = 4096;
        while (maxLen-- > 0) {
            const b = this.cpu.readByte(addr++);
            if (b === 0) break;
            str += String.fromCharCode(b);
        }
        this.terminal.write(str);
    }

    // Writes signed 32-bit integer in EAX with leading + or -
    WriteInt() {
        const val = this.cpu.regs.EAX | 0; // signed 32-bit
        const sign = val >= 0 ? '+' : '';
        this.terminal.write(sign + val.toString());
    }

    // Writes unsigned 32-bit integer in EAX
    WriteDec() {
        const val = this.cpu.regs.EAX >>> 0;
        this.terminal.write(val.toString());
    }

    // Writes 32-bit hex in EAX
    WriteHex() {
        this.terminal.write(this.toHex32(this.cpu.regs.EAX));
    }

    // Writes 32-bit binary in EAX
    WriteBin() {
        this.terminal.write(this.toBin32(this.cpu.regs.EAX));
    }

    // Writes character in AL
    WriteChar() {
        const charCode = this.cpu.regs.EAX & 0xFF;
        this.terminal.write(String.fromCharCode(charCode));
    }

    // Carriage return + line feed
    Crlf() {
        this.terminal.write('\n');
    }

    // Clear console screen
    Clrscr() {
        this.terminal.clear();
    }

    // Read signed integer from terminal into EAX
    async ReadInt() {
        const input = await this.terminal.readLine();
        const val = parseInt(input.trim(), 10) || 0;
        this.cpu.setReg('EAX', val | 0);
    }

    // Read unsigned integer from terminal into EAX
    async ReadDec() {
        const input = await this.terminal.readLine();
        const val = parseInt(input.trim(), 10) || 0;
        this.cpu.setReg('EAX', val >>> 0);
    }

    // Read hex integer from terminal into EAX
    async ReadHex() {
        const input = await this.terminal.readLine();
        const clean = input.trim().replace(/^0x/i, '').replace(/h$/i, '');
        const val = parseInt(clean, 16) || 0;
        this.cpu.setReg('EAX', val >>> 0);
    }

    // Read single character into AL
    async ReadChar() {
        const input = await this.terminal.readLine();
        const ch = input.length > 0 ? input.charCodeAt(0) : 0;
        this.cpu.setReg('AL', ch);
    }

    // Read string into buffer pointed by EDX, max length in ECX. Returns length in EAX
    async ReadString() {
        const maxLen = this.cpu.regs.ECX > 0 ? this.cpu.regs.ECX - 1 : 128;
        const input = await this.terminal.readLine();
        let targetAddr = this.cpu.regs.EDX;
        let actualLen = Math.min(input.length, maxLen);

        for (let i = 0; i < actualLen; i++) {
            this.cpu.writeByte(targetAddr + i, input.charCodeAt(i));
        }
        this.cpu.writeByte(targetAddr + actualLen, 0); // null terminate
        this.cpu.setReg('EAX', actualLen);
    }

    Randomize() {
        this.rngSeed = Date.now();
    }

    RandomRange() {
        // EAX contains upper limit (range 0 to EAX-1)
        const limit = this.cpu.regs.EAX;
        if (limit <= 0) {
            this.cpu.setReg('EAX', 0);
            return;
        }
        const rand = Math.floor(Math.random() * limit);
        this.cpu.setReg('EAX', rand);
    }

    Random32() {
        const rand = Math.floor(Math.random() * 0x100000000);
        this.cpu.setReg('EAX', rand);
    }

    async WaitMsg() {
        this.terminal.write('Press [Enter] to continue . . . ');
        await this.terminal.readLine();
        this.terminal.write('\n');
    }

    async Delay() {
        const ms = this.cpu.regs.EAX;
        await new Promise(r => setTimeout(r, Math.min(ms, 5000)));
    }

    SetTextColor() {
        const color = this.cpu.regs.EAX & 0xFF;
        this.terminal.setColor(color);
    }

    Gotoxy() {
        // DH = row, DL = col
        const row = (this.cpu.regs.EDX >> 8) & 0xFF;
        const col = this.cpu.regs.EDX & 0xFF;
        // Visual indicator in terminal
    }

    StrLength() {
        let addr = this.cpu.regs.EDX;
        let len = 0;
        while (this.cpu.readByte(addr + len) !== 0) {
            len++;
        }
        this.cpu.setReg('EAX', len);
    }

    StrCopy() {
        let src = this.cpu.regs.ESI;
        let dest = this.cpu.regs.EDI;
        while (true) {
            const b = this.cpu.readByte(src++);
            this.cpu.writeByte(dest++, b);
            if (b === 0) break;
        }
    }

    StrCompare() {
        let src = this.cpu.regs.ESI;
        let dest = this.cpu.regs.EDI;
        while (true) {
            const b1 = this.cpu.readByte(src++);
            const b2 = this.cpu.readByte(dest++);
            if (b1 !== b2 || b1 === 0) {
                this.cpu.updateSubFlags(b1, b2, b1 - b2, 1);
                break;
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Irvine32;
}
