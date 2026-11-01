/**
 * Offline AI Code Generator & Converter for MASM (32-bit Irvine32) and TASM (16-bit 8086 DOS)
 * Runs 100% locally and offline without external API keys or network dependencies.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.AssemblyAI = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    // Helper to format numbers cleanly
    function parseNumbers(text) {
        // Filter out phrase counts like "3 numbers", "2 integers", "5 elements" so they don't count as operand data
        let filtered = text.replace(/\b(?:two|three|four|five|six|seven|eight|nine|ten|[1-9])\s+(?:numbers|values|integers|elements|terms|rows)\b/gi, '');
        const matches = filtered.match(/-?\b\d+\b/g);
        return matches ? matches.map(n => parseInt(n, 10)) : [];
    }

    // Helper to extract quoted string or text after words like "print", "display", "say"
    function extractString(text) {
        const quoteMatch = text.match(/["']([^"']+)["']/);
        if (quoteMatch) return quoteMatch[1];
        const printMatch = text.match(/(?:print|display|write|show|output)\s+([a-zA-Z0-9\s!?,]+)/i);
        if (printMatch) {
            let str = printMatch[1].trim();
            str = str.replace(/^(the|a|an|message|string)\s+/i, '');
            if (str.length > 0 && !/^(number|array|result|sum|max|min|even|odd)$/i.test(str)) {
                return str;
            }
        }
        return "Hello, World!";
    }

    // Library of Assembly Templates with dynamic parameterization
    const TEMPLATES = [
        // 0. User Input Math (Take 2 numbers from user and add/subtract/multiply/divide)
        {
            id: 'user_input_math',
            match: (t) => /(?:take|input|read|get|ask|accept).*(?:two|2|\b)?.*(?:numbers?|digits?|values?|integers?|inputs?).*(?:sum|add|sub|diff|multipl|product|div)/i.test(t) ||
                          /(?:sum|add|sub|difference|product|multiply).*(?:of|for|two|2)?.*(?:input|user|entered)/i.test(t) ||
                          /(?:two|2)\s+numbers.*(?:from\s+user|by\s+user)/i.test(t),
            generate: (prompt) => {
                let op = "add";
                let titleOp = "Sum";
                let masmOp = "add eax, num2";
                let tasmOp = "add al, num2";

                if (/sub|diff|minus/i.test(prompt)) {
                    op = "sub"; titleOp = "Difference";
                    masmOp = "sub eax, num2";
                    tasmOp = "sub al, num2";
                } else if (/multipl|product|times/i.test(prompt)) {
                    op = "mul"; titleOp = "Product";
                    masmOp = "imul eax, num2";
                    tasmOp = "mul num2";
                }

                return {
                    title: `Take 2 Numbers from User and Display ${titleOp}`,
                    analysis: `Prompts user to enter two numbers sequentially, reads them from the keyboard, computes the ${titleOp.toLowerCase()} using '${op.toUpperCase()}', and displays the result.`,
                    masm: `INCLUDE Irvine32.inc

.data
    prompt1 BYTE "Enter first number: ", 0
    prompt2 BYTE "Enter second number: ", 0
    resMsg  BYTE "${titleOp} = ", 0
    num1    DWORD ?
    num2    DWORD ?

.code
main PROC
    ; 1. Prompt & read first number from user
    mov edx, OFFSET prompt1
    call WriteString
    call ReadInt        ; Reads signed integer into EAX
    mov num1, eax

    ; 2. Prompt & read second number from user
    mov edx, OFFSET prompt2
    call WriteString
    call ReadInt        ; Reads signed integer into EAX
    mov num2, eax

    ; 3. Perform calculation
    mov eax, num1
    ${masmOp}

    ; 4. Display result
    mov edx, OFFSET resMsg
    call WriteString
    call WriteInt
    call Crlf

    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    prompt1 DB "Enter first number: $"
    prompt2 DB 0Dh, 0Ah, "Enter second number: $"
    resMsg  DB 0Dh, 0Ah, "${titleOp} = $"
    crlf    DB 0Dh, 0Ah, '$'
    num1    DB ?
    num2    DB ?

.code
main PROC
    mov ax, @data
    mov ds, ax

    ; 1. Prompt & read first digit from user
    lea dx, prompt1
    mov ah, 09h
    int 21h

    mov ah, 01h         ; Read char with echo
    int 21h
    sub al, '0'         ; Convert ASCII ('3') to numeric value (3)
    mov num1, al

    ; 2. Prompt & read second digit from user
    lea dx, prompt2
    mov ah, 09h
    int 21h

    mov ah, 01h         ; Read char with echo
    int 21h
    sub al, '0'         ; Convert ASCII ('5') to numeric value (5)
    mov num2, al

    ; 3. Perform operation
    mov al, num1
    ${tasmOp}
    mov ah, 0           ; Clear AH for division (AX = result)

    ; 4. Print result label
    push ax
    lea dx, resMsg
    mov ah, 09h
    int 21h
    pop ax

    ; 5. Print decimal result (handles 1-digit and 2-digit results 0-99)
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax

    cmp bl, 0           ; Skip leading zero if result < 10
    je print_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h

print_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    ; 6. Print newline
    lea dx, crlf
    mov ah, 09h
    int 21h

    ; Exit
    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Input Mechanism: MASM Irvine32 provides 'ReadInt' which reads full multi-digit numbers directly into EAX; TASM uses DOS 'INT 21h (AH=01h)' to read keystroke ASCII characters and subtracts '0' (30h).",
                        "Registers: MASM calculates using 32-bit registers (EAX); TASM calculates using 8-bit registers (AL) and 16-bit AX.",
                        "Display: MASM uses 'WriteInt'; TASM divides by 10 to extract tens & units digits and prints them with DOS Function 02h."
                    ]
                };
            }
        },

        // 1. Hello World / Print String
        {
            id: 'print_string',
            match: (t) => /hello\s*world|print.*(?:string|message|text)|display.*(?:string|message|text)|write.*(?:string|message)/i.test(t) ||
                          (/print|display/i.test(t) && /["'].*["']/.test(t)),
            generate: (prompt) => {
                const str = extractString(prompt);
                return {
                    title: `Display String / Message ("${str}")`,
                    analysis: `Prints the text message to the standard console. MASM uses Irvine32's WriteString with a null-terminated string; TASM uses DOS 21h Function 09h with a '$'-terminated string.`,
                    masm: `INCLUDE Irvine32.inc

.data
    message BYTE "${str}", 0Dh, 0Ah, 0

.code
main PROC
    ; EDX holds the memory offset of the null-terminated string
    mov edx, OFFSET message
    call WriteString

    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    ; TASM DOS Function 09h requires string to terminate with '$'
    message DB "${str}", 0Dh, 0Ah, '$'

.code
main PROC
    ; Initialize Data Segment (DS) register
    mov ax, @data
    mov ds, ax

    ; DX holds offset of $-terminated string
    lea dx, message
    mov ah, 09h         ; DOS interrupt: Display String
    int 21h

    ; Terminate Program
    mov ah, 4Ch         ; DOS exit code
    int 21h
main ENDP
END main`,
                    differences: [
                        "String Termination: MASM Irvine32 uses 0 (null-terminated); TASM DOS Function 09h requires '$'.",
                        "Data Segment: TASM requires explicit DS initialization ('mov ax, @data' / 'mov ds, ax'); MASM (flat memory model) handles this automatically.",
                        "API Mechanism: MASM calls 'WriteString' library procedure; TASM uses 16-bit DOS interrupt 'INT 21h' with AH=09h.",
                        "Registers: MASM operates with 32-bit registers (EDX, EAX); TASM operates with 16-bit registers (DX, AX)."
                    ]
                };
            }
        },

        // 2. Add Two Numbers
        {
            id: 'add_two_numbers',
            match: (t) => /add.*(?:two|2)?.*(?:num|number|integer|value)|sum.*(?:two|2).*num/i.test(t),
            generate: (prompt) => {
                const nums = parseNumbers(prompt);
                const n1 = nums[0] !== undefined ? nums[0] : 15;
                const n2 = nums[1] !== undefined ? nums[1] : 27;
                return {
                    title: `Add Two Numbers (${n1} + ${n2})`,
                    analysis: `Loads two integer operands into CPU registers, performs the ADD operation, and outputs the result.`,
                    masm: `INCLUDE Irvine32.inc

.data
    val1   DWORD ${n1}
    val2   DWORD ${n2}
    sum    DWORD ?
    msg    BYTE "Sum = ", 0

.code
main PROC
    mov eax, val1       ; Load first number into 32-bit EAX
    add eax, val2       ; Add second number
    mov sum, eax        ; Store result into memory

    ; Display Result
    mov edx, OFFSET msg
    call WriteString
    mov eax, sum
    call WriteInt       ; Display signed decimal integer
    call Crlf

    call DumpRegs       ; Inspect register states
    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    val1   DW ${n1}
    val2   DW ${n2}
    sum    DW ?
    msg    DB "Sum = $"
    crlf   DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov ax, val1        ; Load first number into 16-bit AX
    add ax, val2        ; Add second number
    mov sum, ax         ; Store result in variable

    ; Print prefix message
    lea dx, msg
    mov ah, 09h
    int 21h

    ; Print 2-digit decimal number (sum in AX)
    mov ax, sum
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax

    ; Print tens digit
    mov dl, bl
    add dl, 30h         ; Convert to ASCII
    mov ah, 02h
    int 21h

    ; Print units digit
    mov dl, bh
    add dl, 30h         ; Convert to ASCII
    mov ah, 02h
    int 21h

    ; Print Newline
    lea dx, crlf
    mov ah, 09h
    int 21h

    ; Exit to DOS
    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Data Types: MASM uses DWORD (32-bit, 4 bytes); TASM uses DW (Data Word, 16-bit, 2 bytes).",
                        "Registers: MASM adds using 32-bit register EAX; TASM uses 16-bit register AX.",
                        "Output Method: MASM Irvine32 provides built-in 'call WriteInt'; TASM prints digits directly via DOS INT 21h."
                    ]
                };
            }
        },

        // 3. Subtract Two Numbers & Flags
        {
            id: 'sub_two_numbers',
            match: (t) => /sub(?:tract)?.*(?:two|2)?.*(?:num|number|integer|value)|difference/i.test(t) ||
                          /flag.*(?:sub|subtraction|carry|sign|zero)/i.test(t),
            generate: (prompt) => {
                const nums = parseNumbers(prompt);
                const n1 = nums[0] !== undefined ? nums[0] : 10;
                const n2 = nums[1] !== undefined ? nums[1] : 25;
                return {
                    title: `Subtract Two Numbers (${n1} - ${n2}) & Flag Status`,
                    analysis: `Subtracts operand 2 from operand 1 using the SUB instruction. Updates the CPU Status Flags (ZF, SF, CF, OF).`,
                    masm: `INCLUDE Irvine32.inc

.data
    val1   DWORD ${n1}
    val2   DWORD ${n2}
    diff   DWORD ?
    msg    BYTE "Difference = ", 0

.code
main PROC
    mov eax, val1
    sub eax, val2       ; EAX = val1 - val2 (flags update: SF, ZF, CF)
    mov diff, eax

    mov edx, OFFSET msg
    call WriteString
    mov eax, diff
    call WriteInt
    call Crlf

    ; Display all CPU registers and flags (CF, ZF, SF, OF)
    call DumpRegs

    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    val1   DW ${n1}
    val2   DW ${n2}
    diff   DW ?
    msg    DB "Difference = $"
    crlf   DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov ax, val1
    sub ax, val2        ; AX = val1 - val2
    mov diff, ax

    ; Print label
    lea dx, msg
    mov ah, 09h
    int 21h

    ; Print 2-digit decimal result (0 to 99)
    mov ax, diff
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax

    cmp bl, 0           ; Skip leading zero if tens == 0
    je print_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h

print_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main
`,
                    differences: [
                        "Flags Inspection: MASM Irvine32 has 'DumpRegs' which cleanly outputs CF, SF, ZF, OF, AF, PF; in standard TASM, inspecting flags requires pushf / pop to register or debugging with Turbo Debugger (TD).",
                        "Signed Arithmetic: In both architectures, subtracting larger from smaller sets the Carry Flag (CF=1 for unsigned borrow) and Sign Flag (SF=1)."
                    ]
                };
            }
        },

        // 4. Multiply & Divide
        {
            id: 'multiply_divide',
            match: (t) => /multipl|product|divide|division|quotient|remainder/i.test(t),
            generate: (prompt) => {
                const isDiv = /divide|division|quotient|remainder/i.test(prompt);
                const nums = parseNumbers(prompt);
                const n1 = nums[0] !== undefined ? nums[0] : (isDiv ? 50 : 12);
                const n2 = nums[1] !== undefined ? nums[1] : (isDiv ? 6 : 8);

                if (isDiv) {
                    return {
                        title: `Integer Division (${n1} / ${n2})`,
                        analysis: `Performs 32-bit (MASM) and 16-bit (TASM) division using the DIV instruction, producing quotient and remainder.`,
                        masm: `INCLUDE Irvine32.inc

.data
    dividend   DWORD ${n1}
    divisor    DWORD ${n2}
    msgQuot    BYTE "Quotient  = ", 0
    msgRem     BYTE "Remainder = ", 0

.code
main PROC
    mov edx, 0          ; Clear EDX before 32-bit unsigned DIV
    mov eax, dividend
    mov ecx, divisor
    div ecx             ; EDX:EAX / ECX -> EAX = Quotient, EDX = Remainder

    push edx            ; Save remainder

    mov edx, OFFSET msgQuot
    call WriteString
    call WriteDec       ; Print quotient (in EAX)
    call Crlf

    mov edx, OFFSET msgRem
    call WriteString
    pop eax             ; Retrieve remainder
    call WriteDec
    call Crlf

    exit
main ENDP
END main`,
                        tasm: `.model small
.stack 100h

.data
    dividend   DW ${n1}
    divisor    DW ${n2}
    msgQuot    DB "Quotient  = $"
    msgRem     DB "Remainder = $"
    crlf       DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov dx, 0           ; Clear DX before 16-bit DIV
    mov ax, dividend
    mov bx, divisor
    div bx              ; DX:AX / BX -> AX = Quotient, DX = Remainder

    push dx             ; Save remainder

    ; Display Quotient
    lea dx, msgQuot
    mov ah, 09h
    int 21h

    ; Print quotient in AX
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax
    cmp bl, 0
    je p_quot_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h
p_quot_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

    ; Display Remainder
    lea dx, msgRem
    mov ah, 09h
    int 21h

    pop ax              ; Restore remainder into AX
    mov bl, 10
    div bl
    mov bx, ax
    cmp bl, 0
    je p_rem_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h
p_rem_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                        differences: [
                            "Dividend Register Pair: MASM uses 64-bit pair EDX:EAX divided by a 32-bit register; TASM uses 32-bit pair DX:AX divided by a 16-bit register.",
                            "Remainder Location: In MASM remainder is in EDX; in TASM remainder is in DX."
                        ]
                    };
                } else {
                    return {
                        title: `Multiply Two Numbers (${n1} * ${n2})`,
                        analysis: `Performs multiplication using MUL (unsigned) or IMUL (signed).`,
                        masm: `INCLUDE Irvine32.inc

.data
    val1   DWORD ${n1}
    val2   DWORD ${n2}
    msg    BYTE "Product = ", 0

.code
main PROC
    mov eax, val1
    mov ebx, val2
    mul ebx             ; EDX:EAX = EAX * EBX

    mov edx, OFFSET msg
    call WriteString
    call WriteDec       ; EAX contains lower 32-bits of product
    call Crlf

    exit
main ENDP
END main`,
                        tasm: `.model small
.stack 100h

.data
    val1   DW ${n1}
    val2   DW ${n2}
    msg    DB "Product = $"
    crlf   DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov ax, val1
    mov bx, val2
    mul bx              ; DX:AX = AX * BX

    lea dx, msg
    mov ah, 09h
    int 21h

    ; Print product in AX (0 to 99)
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax
    cmp bl, 0
    je p_prod_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h
p_prod_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                        differences: [
                            "Multiplication Sizing: MASM 32-bit MUL stores product in EDX:EAX (up to 64-bit); TASM 16-bit MUL stores product in DX:AX (up to 32-bit)."
                        ]
                    };
                }
            }
        },

        // 5. User Input (Read Number or Character)
        {
            id: 'user_input',
            match: (t) => /input.*(?:from\s+user|number|char|integer)|read.*(?:user|number|integer|char)|take.*input/i.test(t),
            generate: (prompt) => {
                const isChar = /char/i.test(prompt);
                if (isChar) {
                    return {
                        title: "Read Single Character from User & Echo",
                        analysis: "Reads a single keystroke from the console keyboard and prints it back to the screen.",
                        masm: `INCLUDE Irvine32.inc

.data
    prompt BYTE "Enter a character: ", 0
    echoMsg BYTE "You typed: ", 0

.code
main PROC
    mov edx, OFFSET prompt
    call WriteString

    call ReadChar       ; AL contains ASCII character (no enter needed)

    push eax            ; Save character

    mov edx, OFFSET echoMsg
    call WriteString
    pop eax
    call WriteChar      ; Output character from AL
    call Crlf

    exit
main ENDP
END main`,
                        tasm: `.model small
.stack 100h

.data
    prompt  DB "Enter a character: $"
    echoMsg DB 0Dh, 0Ah, "You typed: $"

.code
main PROC
    mov ax, @data
    mov ds, ax

    ; Print prompt
    lea dx, prompt
    mov ah, 09h
    int 21h

    ; Read character from standard input (with echo)
    mov ah, 01h         ; DOS Service 01h: Read Character into AL
    int 21h
    mov bl, al          ; Save typed character into BL

    ; Print echo message
    lea dx, echoMsg
    mov ah, 09h
    int 21h

    ; Print character back
    mov dl, bl
    mov ah, 02h         ; DOS Service 02h: Write Character in DL
    int 21h

    ; Exit
    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                        differences: [
                            "I/O Functions: MASM uses Irvine32 'ReadChar' & 'WriteChar'; TASM uses DOS Interrupt 21h (AH=01h for reading with echo, AH=02h for writing DL).",
                            "Character Register: In both systems, the ASCII code is received in AL."
                        ]
                    };
                } else {
                    return {
                        title: "Read Integer from User and Double It",
                        analysis: "Prompts the user for a numeric value, reads the input, multiplies it by 2, and displays the result.",
                        masm: `INCLUDE Irvine32.inc

.data
    prompt BYTE "Enter an integer: ", 0
    resMsg BYTE "Double your number = ", 0

.code
main PROC
    mov edx, OFFSET prompt
    call WriteString

    call ReadInt        ; Reads 32-bit signed integer into EAX

    ; Multiply by 2
    shl eax, 1

    mov edx, OFFSET resMsg
    call WriteString
    call WriteInt
    call Crlf

    exit
main ENDP
END main`,
                        tasm: `.model small
.stack 100h

.data
    prompt DB "Enter an integer: $"
    resMsg DB 0Dh, 0Ah, "Double your number = $"
    crlf   DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    lea dx, prompt
    mov ah, 09h
    int 21h

    ; Read single digit from user
    mov ah, 01h
    int 21h
    sub al, '0'         ; Convert ASCII to number
    mov ah, 0

    ; Multiply by 2
    shl ax, 1

    push ax             ; Preserve result

    lea dx, resMsg
    mov ah, 09h
    int 21h

    pop ax
    ; Print result in AX
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax
    cmp bl, 0
    je p_dbl_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h
p_dbl_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                        differences: [
                            "Multi-digit Input: MASM Irvine32 has a built-in 'ReadInt' routine. In TASM DOS assembly, you must parse individual keystroke ASCII digits ('0'-'9') in a loop (accumulating AX = AX * 10 + digit)."
                        ]
                    };
                }
            }
        },

        // 6. Check Even or Odd
        {
            id: 'even_odd',
            match: (t) => /even.*odd|odd.*even|check.*even|is.*even/i.test(t),
            generate: (prompt) => {
                const nums = parseNumbers(prompt);
                const n = nums[0] !== undefined ? nums[0] : 14;
                return {
                    title: `Check if a Number (${n}) is Even or Odd`,
                    analysis: `Uses the TEST instruction with bit mask 1 (or SHR/AND). If the least significant bit is 0, the number is Even; if 1, it is Odd.`,
                    masm: `INCLUDE Irvine32.inc

.data
    num      DWORD ${n}
    msgEven  BYTE "The number is EVEN", 0Dh, 0Ah, 0
    msgOdd   BYTE "The number is ODD", 0Dh, 0Ah, 0

.code
main PROC
    mov eax, num

    ; Bitwise test the lowest bit: 0 = Even, 1 = Odd
    test eax, 1
    jnz is_odd          ; Jump if Zero Flag == 0 (Odd)

    mov edx, OFFSET msgEven
    call WriteString
    jmp finish

is_odd:
    mov edx, OFFSET msgOdd
    call WriteString

finish:
    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    num      DW ${n}
    msgEven  DB "The number is EVEN$", 0Dh, 0Ah, '$'
    msgOdd   DB "The number is ODD$", 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov ax, num

    ; Test lowest bit (AND without modifying AX)
    test ax, 1
    jnz is_odd

    lea dx, msgEven
    mov ah, 09h
    int 21h
    jmp finish

is_odd:
    lea dx, msgOdd
    mov ah, 09h
    int 21h

finish:
    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Logic & Flags: Both MASM and TASM use identical 'TEST' and conditional jump ('JNZ') instructions; 'TEST' sets ZF=1 when the result of the bitwise AND is zero.",
                        "Directives & Calls: MASM uses 'call WriteString' and 32-bit DWORD, while TASM uses 'int 21h (AH=09h)' with $-strings and 16-bit DW."
                    ]
                };
            }
        },

        // 7. Find Largest / Maximum of Numbers
        {
            id: 'max_number',
            match: (t) => /largest|maximum|greater|max.*(?:two|three|3|numbers)|compare.*larger/i.test(t),
            generate: (prompt) => {
                const nums = parseNumbers(prompt);
                const isThree = /three|3/i.test(prompt) || nums.length >= 3;
                const a = nums[0] !== undefined ? nums[0] : 45;
                const b = nums[1] !== undefined ? nums[1] : 78;
                const c = nums[2] !== undefined ? nums[2] : 23;

                if (isThree) {
                    return {
                        title: `Find Largest of 3 Numbers (${a}, ${b}, ${c})`,
                        analysis: `Compares 3 values using CMP and conditional jump JG (Jump if Greater) to find and output the maximum.`,
                        masm: `INCLUDE Irvine32.inc

.data
    val1 DWORD ${a}
    val2 DWORD ${b}
    val3 DWORD ${c}
    max  DWORD ?
    msg  BYTE "Largest number is: ", 0

.code
main PROC
    mov eax, val1       ; Assume val1 is max
    mov max, eax

    mov ebx, val2
    cmp ebx, max
    jle check_third     ; If val2 <= max, skip
    mov max, ebx        ; Otherwise val2 is new max

check_third:
    mov ecx, val3
    cmp ecx, max
    jle display_result
    mov max, ecx

display_result:
    mov edx, OFFSET msg
    call WriteString
    mov eax, max
    call WriteInt
    call Crlf

    exit
main ENDP
END main`,
                        tasm: `.model small
.stack 100h

.data
    val1 DW ${a}
    val2 DW ${b}
    val3 DW ${c}
    max  DW ?
    msg  DB "Largest number is: $"
    crlf DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov ax, val1
    mov max, ax

    mov bx, val2
    cmp bx, max
    jle check_third
    mov max, bx

check_third:
    mov cx, val3
    cmp cx, max
    jle display_result
    mov max, cx

display_result:
    lea dx, msg
    mov ah, 09h
    int 21h

    ; Self-contained decimal print (AX = max)
    mov ax, max
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax

    cmp bl, 0           ; Skip leading zero if single digit
    je print_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h

print_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                        differences: [
                            "Conditional Jumps: 'JLE' (Jump if Less than or Equal) and 'JG' (Jump if Greater) are identical across x86-16 and x86-32 for signed values.",
                            "Registers: MASM leverages full 32-bit registers (EAX, EBX, ECX); TASM uses 16-bit AX, BX, CX."
                        ]
                    };
                } else {
                    return {
                        title: `Compare Two Numbers & Find Larger (${a} vs ${b})`,
                        analysis: `Compares two numbers using CMP and branches using JG/JLE to store and print the larger value.`,
                        masm: `INCLUDE Irvine32.inc

.data
    n1  DWORD ${a}
    n2  DWORD ${b}
    msg BYTE "The larger number is: ", 0

.code
main PROC
    mov eax, n1
    cmp eax, n2
    jge first_is_larger

    mov eax, n2         ; n2 is larger

first_is_larger:
    mov edx, OFFSET msg
    call WriteString
    call WriteInt
    call Crlf

    exit
main ENDP
END main`,
                        tasm: `.model small
.stack 100h

.data
    n1   DW ${a}
    n2   DW ${b}
    msg  DB "The larger number is: $"
    crlf DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov ax, n1
    cmp ax, n2
    jge first_is_larger

    mov ax, n2

first_is_larger:
    push ax

    lea dx, msg
    mov ah, 09h
    int 21h

    pop ax
    ; Self-contained decimal print (AX = larger)
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax

    cmp bl, 0           ; Skip leading zero if single digit
    je print_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h

print_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                        differences: [
                            "Jump Instruction: JGE (Jump if Greater or Equal) handles signed comparisons in both MASM & TASM.",
                            "TASM prints digits directly via DOS INT 21h; MASM uses Irvine32 WriteInt."
                        ]
                    };
                }
            }
        },

        // 8. Loop 1 to N / Print Numbers
        {
            id: 'loop_counter',
            match: (t) => /loop.*(?:1\s*to\s*\d+|\d+\s*times|counter)|print.*numbers.*(?:1\s*to|from)/i.test(t),
            generate: (prompt) => {
                const nums = parseNumbers(prompt);
                const count = nums[0] !== undefined ? nums[0] : 10;
                return {
                    title: `Count & Print Numbers from 1 to ${count} using LOOP`,
                    analysis: `Uses the hardware LOOP instruction which automatically decrements ECX/CX and branches until count reaches 0.`,
                    masm: `INCLUDE Irvine32.inc

.data
    counter DWORD 1
    msg     BYTE " ", 0

.code
main PROC
    mov ecx, ${count}   ; Loop counter in ECX

print_loop:
    push ecx            ; Save outer loop counter
    mov eax, counter
    call WriteDec       ; Print current counter value

    mov edx, OFFSET msg
    call WriteString    ; Print space

    inc counter
    pop ecx             ; Restore counter
    loop print_loop     ; Decrements ECX; jumps if ECX != 0

    call Crlf
    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    counter DW 1
    space   DB " $"
    crlf    DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov cx, ${count}   ; 16-bit loop counter in CX

print_loop:
    push cx             ; Save loop counter

    ; Print counter (0 to 99)
    mov ax, counter
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax
    cmp bl, 0
    je p_cnt_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h
p_cnt_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, space
    mov ah, 09h
    int 21h

    inc counter
    pop cx
    loop print_loop     ; Decrements CX, repeats if CX != 0

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Loop Counter Register: MASM uses 32-bit ECX; TASM uses 16-bit CX for the 'LOOP' instruction.",
                        "Stack Usage: Always push and pop ECX/CX around output routines so procedures do not clobber your loop counter."
                    ]
                };
            }
        },

        // 9. Array Sum and Average
        {
            id: 'array_sum',
            match: (t) => /array.*(?:sum|total|average)|sum.*array|add.*elements/i.test(t),
            generate: (prompt) => {
                const nums = parseNumbers(prompt);
                const arr = nums.length >= 3 ? nums : [10, 20, 30, 40, 50];
                const arrStr = arr.join(', ');
                const len = arr.length;
                return {
                    title: `Calculate Sum and Average of Array [${arrStr}]`,
                    analysis: `Iterates through an array in memory using index/pointer registers (ESI/SI) with a loop, accumulating the total sum and computing integer average.`,
                    masm: `INCLUDE Irvine32.inc

.data
    array    DWORD ${arrStr}
    arrCount DWORD ${len}
    sumMsg   BYTE "Sum of Array     = ", 0
    avgMsg   BYTE "Average of Array = ", 0

.code
main PROC
    mov esi, OFFSET array       ; ESI points to first element
    mov ecx, arrCount           ; ECX holds element count
    mov eax, 0                  ; EAX accumulates sum

sum_loop:
    add eax, [esi]              ; Add current DWORD element
    add esi, TYPE array         ; Advance pointer by 4 bytes
    loop sum_loop

    push eax                    ; Save sum for average calculation

    ; Print Sum
    mov edx, OFFSET sumMsg
    call WriteString
    call WriteInt
    call Crlf

    ; Calculate Average
    pop eax
    mov edx, 0
    mov ebx, arrCount
    div ebx                     ; EAX = Sum / Count

    ; Print Average
    mov edx, OFFSET avgMsg
    call WriteString
    call WriteDec
    call Crlf

    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    array   DW ${arrStr}
    arrLen  EQU ${len}
    sumMsg  DB "Sum of Array     = $"
    avgMsg  DB "Average of Array = $"
    crlf    DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    lea si, array               ; SI points to start of array
    mov cx, arrLen              ; CX = loop counter
    mov ax, 0                   ; AX accumulates sum

sum_loop:
    add ax, [si]                ; Add 16-bit word
    add si, 2                   ; Advance pointer by 2 bytes (word size)
    loop sum_loop

    push ax                     ; Save sum

    ; Print Sum in AX (multi-digit)
    lea dx, sumMsg
    mov ah, 09h
    int 21h

    mov cx, 0
    mov bx, 10
p_sum_div:
    mov dx, 0
    div bx
    push dx
    inc cx
    cmp ax, 0
    jne p_sum_div
p_sum_print:
    pop dx
    add dl, '0'
    mov ah, 02h
    int 21h
    loop p_sum_print

    lea dx, crlf
    mov ah, 09h
    int 21h

    ; Calculate Average (DX:AX / BX)
    pop ax
    mov dx, 0
    mov bx, arrLen
    div bx                      ; AX = Average

    ; Print Average
    push ax
    lea dx, avgMsg
    mov ah, 09h
    int 21h
    pop ax

    mov cx, 0
    mov bx, 10
p_avg_div:
    mov dx, 0
    div bx
    push dx
    inc cx
    cmp ax, 0
    jne p_avg_div
p_avg_print:
    pop dx
    add dl, '0'
    mov ah, 02h
    int 21h
    loop p_avg_print

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Pointer Arithmetic: MASM DWORDs are 4 bytes each ('add esi, 4' or 'TYPE array'); TASM DW (words) are 2 bytes each ('add si, 2').",
                        "Pointer Registers: MASM uses 32-bit ESI; TASM uses 16-bit SI."
                    ]
                };
            }
        },

        // 10. Find Max / Min in Array
        {
            id: 'array_max_min',
            match: (t) => /array.*(?:max|min|largest|smallest)|find.*(?:largest|smallest|max|min).*in.*array/i.test(t),
            generate: (prompt) => {
                const isMin = /min|smallest/i.test(prompt);
                const label = isMin ? "Smallest" : "Largest";
                const jmpInst = isMin ? "jge" : "jle"; // Skip if current is worse
                return {
                    title: `Find ${label} Element in Array [34, 12, 89, 5, 67]`,
                    analysis: `Scans array elements sequentially, comparing each element to the running ${label.toLowerCase()} value and updating when an extreme is found.`,
                    masm: `INCLUDE Irvine32.inc

.data
    array    DWORD 34, 12, 89, 5, 67
    arrCount DWORD 5
    msg      BYTE "The ${label} element is: ", 0

.code
main PROC
    mov esi, OFFSET array
    mov eax, [esi]          ; Initialize candidate with first element
    add esi, 4
    mov ecx, arrCount
    dec ecx                 ; Remaining elements to check

find_loop:
    mov ebx, [esi]
    cmp ebx, eax
    ${jmpInst} skip_update      ; Skip if not ${label.toLowerCase()}
    mov eax, ebx            ; Update ${label.toLowerCase()}

skip_update:
    add esi, 4
    loop find_loop

    ; Print result
    mov edx, OFFSET msg
    call WriteString
    call WriteInt
    call Crlf

    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    array  DW 34, 12, 89, 5, 67
    arrLen EQU 5
    msg    DB "The ${label} element is: $"
    crlf   DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    lea si, array
    mov ax, [si]            ; First element as baseline
    add si, 2
    mov cx, arrLen - 1

find_loop:
    mov bx, [si]
    cmp bx, ax
    ${jmpInst} skip_update
    mov ax, bx              ; Update ${label.toLowerCase()}

skip_update:
    add si, 2
    loop find_loop

    push ax
    lea dx, msg
    mov ah, 09h
    int 21h
    pop ax

    ; Print element in AX (0 to 99)
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax
    cmp bl, 0
    je p_arr_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h
p_arr_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Size Increment: 'add esi, 4' (MASM 32-bit DWORD) vs 'add si, 2' (TASM 16-bit WORD).",
                        "Register Allocation: In MASM, EAX holds the result; in TASM, AX holds the result."
                    ]
                };
            }
        },

        // 11. Reverse a String
        {
            id: 'reverse_string',
            match: (t) => /reverse.*(?:string|text|word)|palindrome/i.test(t),
            generate: (prompt) => {
                const isPal = /palindrome/i.test(prompt);
                if (isPal) {
                    return {
                        title: "Check if a String is a Palindrome",
                        analysis: "Sets two pointers (start and end). Compares characters inward until mismatch or pointers cross.",
                        masm: `INCLUDE Irvine32.inc

.data
    targetStr BYTE "radar", 0
    strLen    = ($ - targetStr) - 1
    yesMsg    BYTE "The string is a PALINDROME!", 0Dh, 0Ah, 0
    noMsg     BYTE "The string is NOT a palindrome.", 0Dh, 0Ah, 0

.code
main PROC
    mov esi, OFFSET targetStr               ; ESI points to start
    mov edi, OFFSET targetStr + strLen - 1  ; EDI points to last char

check_loop:
    cmp esi, edi
    jge is_palindrome       ; Pointers met/crossed -> Success

    mov al, [esi]
    mov bl, [edi]
    cmp al, bl
    jne not_palindrome      ; Mismatch found

    inc esi
    dec edi
    jmp check_loop

is_palindrome:
    mov edx, OFFSET yesMsg
    call WriteString
    jmp finish

not_palindrome:
    mov edx, OFFSET noMsg
    call WriteString

finish:
    exit
main ENDP
END main`,
                        tasm: `.model small
.stack 100h

.data
    targetStr DB "radar"
    strLen    EQU 5
    yesMsg    DB "The string is a PALINDROME!$", 0Dh, 0Ah, '$'
    noMsg     DB "The string is NOT a palindrome.$", 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    lea si, targetStr
    lea di, targetStr
    add di, strLen - 1      ; DI points to end

check_loop:
    cmp si, di
    jge is_palindrome

    mov al, [si]
    mov bl, [di]
    cmp al, bl
    jne not_palindrome

    inc si
    dec di
    jmp check_loop

is_palindrome:
    lea dx, yesMsg
    mov ah, 09h
    int 21h
    jmp finish

not_palindrome:
    lea dx, noMsg
    mov ah, 09h
    int 21h

finish:
    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                        differences: [
                            "String Pointers: MASM uses 32-bit index registers ESI & EDI; TASM uses 16-bit SI & DI.",
                            "String Size: In MASM 'strLen = ($ - targetStr) - 1' automatically calculates length excluding the null terminator."
                        ]
                    };
                } else {
                    return {
                        title: "Reverse a String using Stack PUSH / POP",
                        analysis: "Pushes every character of the string onto the runtime stack, then pops them off in LIFO (Last-In-First-Out) order to reverse it.",
                        masm: `INCLUDE Irvine32.inc

.data
    original BYTE "Assembly", 0
    strLen   = ($ - original) - 1
    revStr   BYTE strLen + 1 DUP(0)
    msg      BYTE "Reversed string: ", 0

.code
main PROC
    mov esi, OFFSET original
    mov ecx, strLen

push_loop:
    movzx eax, BYTE PTR [esi]
    push eax            ; Push character onto stack
    inc esi
    loop push_loop

    mov edi, OFFSET revStr
    mov ecx, strLen

pop_loop:
    pop eax             ; Pop in reverse order
    mov [edi], al
    inc edi
    loop pop_loop

    mov BYTE PTR [edi], 0   ; Null terminate

    mov edx, OFFSET msg
    call WriteString
    mov edx, OFFSET revStr
    call WriteString
    call Crlf

    exit
main ENDP
END main`,
                        tasm: `.model small
.stack 100h

.data
    original DB "Assembly$"
    strLen   EQU 8
    revStr   DB strLen DUP(?), '$'
    msg      DB "Reversed string: $"
    crlf     DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    lea si, original
    mov cx, strLen

push_loop:
    mov al, [si]
    mov ah, 0
    push ax             ; 16-bit PUSH requires Word in 8086
    inc si
    loop push_loop

    lea di, revStr
    mov cx, strLen

pop_loop:
    pop ax              ; Retrieve LIFO character
    mov [di], al
    inc di
    loop pop_loop

    ; Print prefix & reversed string
    lea dx, msg
    mov ah, 09h
    int 21h

    lea dx, revStr
    mov ah, 09h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                        differences: [
                            "Stack Word Size: In 16-bit TASM (8086), stack pushes and pops MUST be 16-bit words (e.g. 'push ax'); in 32-bit MASM, stack pushes are 32-bit DWORDs ('push eax').",
                            "Zero Extension: MASM uses 'movzx eax, BYTE PTR [esi]' to cleanly widen a byte to 32 bits; TASM 8086 uses 'mov al, [si]' then 'mov ah, 0'."
                        ]
                    };
                }
            }
        },

        // 12. Convert Lowercase to Uppercase
        {
            id: 'to_uppercase',
            match: (t) => /upper\s*case|lower\s*to\s*upper|capitalize/i.test(t),
            generate: (prompt) => {
                return {
                    title: "Convert Lowercase String to Uppercase",
                    analysis: "Iterates through each ASCII character. If it falls within 'a' (97) through 'z' (122), subtracts 20h (or ANDs with 0DFh) to convert to uppercase.",
                    masm: `INCLUDE Irvine32.inc

.data
    text BYTE "hello masm world!", 0

.code
main PROC
    mov edx, OFFSET text
    call WriteString
    call Crlf

    mov esi, OFFSET text

convert_loop:
    mov al, [esi]
    cmp al, 0
    je done_convert         ; Null terminator

    cmp al, 'a'
    jb next_char
    cmp al, 'z'
    ja next_char
    sub al, 20h             ; Convert 'a'-'z' to 'A'-'Z'
    mov [esi], al

next_char:
    inc esi
    jmp convert_loop

done_convert:
    mov edx, OFFSET text
    call WriteString
    call Crlf

    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    text DB "hello tasm world!$", 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    lea dx, text
    mov ah, 09h
    int 21h

    lea si, text

convert_loop:
    mov al, [si]
    cmp al, '$'             ; Check DOS terminator
    je done_convert

    cmp al, 'a'
    jb next_char
    cmp al, 'z'
    ja next_char
    sub al, 20h             ; ASCII difference: 32 (20h)
    mov [si], al

next_char:
    inc si
    jmp convert_loop

done_convert:
    lea dx, text
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Loop Termination: MASM checks for '0' (null); TASM checks for '$' (DOS string end).",
                        "Bitwise Trick: Instead of 'sub al, 20h', 'and al, 0DFh' can also be used in both assemblers to clear bit 5."
                    ]
                };
            }
        },

        // 13. Bubble Sort Array
        {
            id: 'bubble_sort',
            match: (t) => /bubble\s*sort|sort.*array|sort.*ascending|ascending.*order/i.test(t),
            generate: (prompt) => {
                return {
                    title: "Bubble Sort Array in Ascending Order",
                    analysis: "Implements nested loops with CMP and XCHG (or temp register) to compare adjacent pairs and bubble larger elements to the right.",
                    masm: `INCLUDE Irvine32.inc

.data
    array    DWORD 50, 20, 40, 10, 30
    arrCount DWORD 5
    msg      BYTE "Sorted Array: ", 0

.code
main PROC
    mov ecx, arrCount
    dec ecx                 ; Outer loop counter (n - 1 passes)

outer_loop:
    push ecx
    mov esi, OFFSET array   ; Reset pointer to start

inner_loop:
    mov eax, [esi]
    mov ebx, [esi + 4]
    cmp eax, ebx
    jle no_swap             ; If [esi] <= [esi+4], already in order

    ; Swap adjacent elements
    mov [esi], ebx
    mov [esi + 4], eax

no_swap:
    add esi, 4              ; Next DWORD
    loop inner_loop

    pop ecx
    dec ecx
    jnz outer_loop

    ; Display sorted array
    mov edx, OFFSET msg
    call WriteString

    mov esi, OFFSET array
    mov ecx, arrCount

print_loop:
    mov eax, [esi]
    call WriteDec
    mov al, ' '
    call WriteChar
    add esi, 4
    loop print_loop

    call Crlf
    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    array  DW 50, 20, 40, 10, 30
    arrLen EQU 5
    msg    DB "Sorted Array: $"
    space  DB " $"
    crlf   DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov cx, arrLen - 1      ; Outer passes

outer_loop:
    push cx
    lea si, array           ; Pointer to start of array

inner_loop:
    mov ax, [si]
    mov bx, [si + 2]
    cmp ax, bx
    jle no_swap

    ; Swap adjacent 16-bit words
    mov [si], bx
    mov [si + 2], ax

no_swap:
    add si, 2               ; Step by 2 bytes (word size)
    loop inner_loop

    pop cx
    dec cx
    jnz outer_loop

    ; Print Result
    lea dx, msg
    mov ah, 09h
    int 21h

    lea si, array
    mov cx, arrLen

print_loop:
    push cx
    mov ax, [si]
    mov bl, 10
    div bl
    mov bx, ax
    cmp bl, 0
    je p_sort_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h
p_sort_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, space
    mov ah, 09h
    int 21h
    add si, 2
    pop cx
    loop print_loop

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Element Offset: MASM uses '[esi + 4]' for adjacent elements; TASM uses '[si + 2]' for adjacent 16-bit words.",
                        "Stack Registers: Both save the outer loop counter on the stack using 'push' and 'pop'."
                    ]
                };
            }
        },

        // 14. Factorial
        {
            id: 'factorial',
            match: (t) => /factorial|n!/i.test(t),
            generate: (prompt) => {
                const nums = parseNumbers(prompt);
                const n = nums[0] !== undefined ? Math.min(Math.max(nums[0], 1), 8) : 5;
                return {
                    title: `Calculate Factorial of ${n} (${n}!)`,
                    analysis: `Initializes accumulator to 1, loads N into counter, and loops downward multiplying product by counter at each step.`,
                    masm: `INCLUDE Irvine32.inc

.data
    n      DWORD ${n}
    result DWORD ?
    msg    BYTE "Factorial = ", 0

.code
main PROC
    mov eax, 1          ; Factorial accumulator
    mov ecx, n          ; Counter = N

fact_loop:
    mul ecx             ; EAX = EAX * ECX
    loop fact_loop

    mov result, eax

    mov edx, OFFSET msg
    call WriteString
    mov eax, result
    call WriteDec
    call Crlf

    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    n      DW ${n}
    result DW ?
    msg    DB "Factorial = $"
    crlf   DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov ax, 1           ; Accumulator
    mov cx, n           ; Counter = N

fact_loop:
    mul cx              ; DX:AX = AX * CX
    loop fact_loop

    mov result, ax

    lea dx, msg
    mov ah, 09h
    int 21h

    ; Print result in AX (multi-digit)
    mov ax, result
    mov cx, 0
    mov bx, 10
p_fact_div:
    mov dx, 0
    div bx
    push dx
    inc cx
    cmp ax, 0
    jne p_fact_div
p_fact_print:
    pop dx
    add dl, '0'
    mov ah, 02h
    int 21h
    loop p_fact_print

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Integer Overflow Threshold: 16-bit TASM registers overflow at 8! (40,320 > 65,535 for 16-bit unsigned); 32-bit MASM registers can calculate up to 12! without overflow.",
                        "Instruction: 'mul ecx' (MASM 32-bit) vs 'mul cx' (TASM 16-bit)."
                    ]
                };
            }
        },

        // 15. Fibonacci Series
        {
            id: 'fibonacci',
            match: (t) => /fibonacci|fib\s*series/i.test(t),
            generate: (prompt) => {
                const nums = parseNumbers(prompt);
                const count = nums[0] !== undefined ? Math.min(Math.max(nums[0], 2), 15) : 7;
                return {
                    title: `Generate First ${count} Terms of Fibonacci Series`,
                    analysis: `Generates sequence where F(0)=0, F(1)=1, and F(n) = F(n-1) + F(n-2) using two sliding registers.`,
                    masm: `INCLUDE Irvine32.inc

.data
    count = ${count}
    msg   BYTE "Fibonacci Series: ", 0

.code
main PROC
    mov edx, OFFSET msg
    call WriteString

    mov eax, 0          ; F(0)
    mov ebx, 1          ; F(1)
    mov ecx, count

fib_loop:
    push eax            ; Save current term
    push ecx

    call WriteDec       ; Print current term
    mov al, ' '
    call WriteChar

    pop ecx
    pop eax

    ; Calculate next term: next = eax + ebx
    mov edx, eax
    add edx, ebx        ; EDX = next
    mov eax, ebx        ; Shift EAX = previous EBX
    mov ebx, edx        ; Shift EBX = next
    loop fib_loop

    call Crlf
    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    count EQU ${count}
    msg   DB "Fibonacci Series: $"
    space DB " $"
    crlf  DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    lea dx, msg
    mov ah, 09h
    int 21h

    mov ax, 0           ; Term 1
    mov bx, 1           ; Term 2
    mov cx, count

fib_loop:
    push ax             ; Preserve registers
    push bx
    push cx

    ; Print term in AX (0 to 99)
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax
    cmp bl, 0
    je p_fib_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h
p_fib_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, space
    mov ah, 09h
    int 21h

    pop cx
    pop bx
    pop ax

    ; Advance terms: next = ax + bx
    mov dx, ax
    add dx, bx          ; DX = next
    mov ax, bx          ; AX = old BX
    mov bx, dx          ; BX = next
    loop fib_loop

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Register Usage: MASM uses EAX, EBX, EDX, ECX; TASM uses 16-bit AX, BX, DX, CX.",
                        "Console Formatting: MASM uses 'WriteChar' with space in AL; TASM displays the '$'-terminated string 'space' via INT 21h AH=09h."
                    ]
                };
            }
        },

        // 16. Swap Two Numbers
        {
            id: 'swap_numbers',
            match: (t) => /swap.*(?:two|2)?.*(?:variables|numbers|values)|exchange/i.test(t),
            generate: (prompt) => {
                const nums = parseNumbers(prompt);
                const n1 = nums[0] !== undefined ? nums[0] : 100;
                const n2 = nums[1] !== undefined ? nums[1] : 200;
                return {
                    title: `Swap Two Numbers (${n1} and ${n2}) using XCHG`,
                    analysis: `Swaps values in memory or registers using the atomic XCHG instruction without needing a third temporary variable.`,
                    masm: `INCLUDE Irvine32.inc

.data
    varA BYTE "Before: EAX = ", 0
    varB BYTE ", EBX = ", 0
    afterMsg BYTE 0Dh, 0Ah, "After XCHG: EAX = ", 0

.code
main PROC
    mov eax, ${n1}
    mov ebx, ${n2}

    ; Display Before
    mov edx, OFFSET varA
    call WriteString
    call WriteDec
    mov edx, OFFSET varB
    call WriteString
    mov eax, ebx
    call WriteDec

    ; Reset & Perform Swap
    mov eax, ${n1}
    xchg eax, ebx        ; Atomic exchange instruction

    ; Display After
    mov edx, OFFSET afterMsg
    call WriteString
    call WriteDec
    mov edx, OFFSET varB
    call WriteString
    mov eax, ebx
    call WriteDec
    call Crlf

    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    msgBefore DB "Before: AX = $"
    msgAnd    DB ", BX = $"
    msgAfter  DB 0Dh, 0Ah, "After XCHG: AX = $"
    crlf      DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov ax, ${n1}
    mov bx, ${n2}

    ; Print Before
    push ax
    push bx
    lea dx, msgBefore
    mov ah, 09h
    int 21h
    pop bx
    pop ax

    ; Print AX
    mov bl, 10
    div bl
    mov dl, bl
    add dl, '0'
    mov dh, ah          ; Save units
    mov ah, 02h
    int 21h
    mov dl, dh
    add dl, '0'
    mov ah, 02h
    int 21h

    push bx
    lea dx, msgAnd
    mov ah, 09h
    int 21h
    pop bx
    mov ax, bx

    ; Print BX
    mov bl, 10
    div bl
    mov dl, bl
    add dl, '0'
    mov dh, ah
    mov ah, 02h
    int 21h
    mov dl, dh
    add dl, '0'
    mov ah, 02h
    int 21h

    ; Execute Swap
    mov ax, ${n1}
    xchg ax, bx         ; 8086 XCHG instruction

    ; Print After
    push ax
    push bx
    lea dx, msgAfter
    mov ah, 09h
    int 21h
    pop bx
    pop ax

    ; Print AX
    mov bl, 10
    div bl
    mov dl, bl
    add dl, '0'
    mov dh, ah
    mov ah, 02h
    int 21h
    mov dl, dh
    add dl, '0'
    mov ah, 02h
    int 21h

    push bx
    lea dx, msgAnd
    mov ah, 09h
    int 21h
    pop bx
    mov ax, bx

    ; Print BX
    mov bl, 10
    div bl
    mov dl, bl
    add dl, '0'
    mov dh, ah
    mov ah, 02h
    int 21h
    mov dl, dh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Instruction: 'xchg' is supported identically in both 32-bit and 16-bit x86.",
                        "Registers: 'xchg eax, ebx' in MASM vs 'xchg ax, bx' in TASM."
                    ]
                };
            }
        },

        // 17. Linear Search in Array
        {
            id: 'linear_search',
            match: (t) => /linear\s*search|search.*array|find.*element.*array/i.test(t),
            generate: (prompt) => {
                const nums = parseNumbers(prompt);
                const target = nums[0] !== undefined ? nums[0] : 42;
                return {
                    title: `Linear Search for Value (${target}) in Array`,
                    analysis: `Loops through array comparing each element with the search key. Jumps to Found when matched, or prints Not Found if loop completes.`,
                    masm: `INCLUDE Irvine32.inc

.data
    array       DWORD 15, 27, 42, 68, 91
    arrCount    DWORD 5
    target      DWORD ${target}
    foundMsg    BYTE "Element FOUND in array at index: ", 0
    notFoundMsg BYTE "Element NOT FOUND in array.", 0Dh, 0Ah, 0

.code
main PROC
    mov esi, OFFSET array
    mov ecx, arrCount
    mov eax, target
    mov edx, 0              ; Index counter

search_loop:
    cmp [esi], eax
    je is_found             ; Match found!
    add esi, 4
    inc edx
    loop search_loop

    ; If we exit loop, item was not found
    mov edx, OFFSET notFoundMsg
    call WriteString
    jmp finish

is_found:
    push edx
    mov edx, OFFSET foundMsg
    call WriteString
    pop eax                 ; Restore index into EAX
    call WriteDec
    call Crlf

finish:
    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    array       DW 15, 27, 42, 68, 91
    arrLen      EQU 5
    target      DW ${target}
    foundMsg    DB "Element FOUND in array at index: $"
    notFoundMsg DB "Element NOT FOUND in array.$", 0Dh, 0Ah, '$'
    crlf        DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    lea si, array
    mov cx, arrLen
    mov ax, target
    mov bx, 0               ; Index counter

search_loop:
    cmp [si], ax
    je is_found
    add si, 2
    inc bx
    loop search_loop

    lea dx, notFoundMsg
    mov ah, 09h
    int 21h
    jmp finish

is_found:
    lea dx, foundMsg
    mov ah, 09h
    int 21h

    ; Print index in BX (0 to 9)
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

finish:
    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Index Stepping: 'add esi, 4' (32-bit DWORD) in MASM vs 'add si, 2' (16-bit WORD) in TASM.",
                        "Match Jump: 'JE' (Jump if Equal) is identical in both."
                    ]
                };
            }
        },

        // 18. Count Vowels in String
        {
            id: 'count_vowels',
            match: (t) => /count.*vowel|vowels.*in.*string/i.test(t),
            generate: (prompt) => {
                return {
                    title: "Count Vowels (A, E, I, O, U) in String",
                    analysis: "Iterates through a string character by character and checks if each character matches 'a', 'e', 'i', 'o', 'u' (both upper and lower).",
                    masm: `INCLUDE Irvine32.inc

.data
    sentence BYTE "Assembly Programming Language", 0
    vowelCount DWORD 0
    msg      BYTE "Total Vowels = ", 0

.code
main PROC
    mov esi, OFFSET sentence

count_loop:
    mov al, [esi]
    cmp al, 0
    je print_result         ; End of string

    ; Convert to lowercase for uniform check
    or al, 20h

    cmp al, 'a'
    je is_vowel
    cmp al, 'e'
    je is_vowel
    cmp al, 'i'
    je is_vowel
    cmp al, 'o'
    je is_vowel
    cmp al, 'u'
    je is_vowel
    jmp next_char

is_vowel:
    inc vowelCount

next_char:
    inc esi
    jmp count_loop

print_result:
    mov edx, OFFSET msg
    call WriteString
    mov eax, vowelCount
    call WriteDec
    call Crlf

    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    sentence   DB "Assembly Programming Language$"
    vowelCount DW 0
    msg        DB "Total Vowels = $"
    crlf       DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    lea si, sentence

count_loop:
    mov al, [si]
    cmp al, '$'             ; DOS end of string
    je print_result

    ; Quick lowercase conversion for alphabets
    or al, 20h

    cmp al, 'a'
    je is_vowel
    cmp al, 'e'
    je is_vowel
    cmp al, 'i'
    je is_vowel
    cmp al, 'o'
    je is_vowel
    cmp al, 'u'
    je is_vowel
    jmp next_char

is_vowel:
    inc vowelCount

next_char:
    inc si
    jmp count_loop

print_result:
    lea dx, msg
    mov ah, 09h
    int 21h

    ; Print count in AX (0 to 99)
    mov ax, vowelCount
    mov bl, 10
    div bl
    mov bx, ax
    cmp bl, 0
    je p_vow_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h
p_vow_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    lea dx, crlf
    mov ah, 09h
    int 21h

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Character Comparison: 'or al, 20h' sets bit 5, transforming uppercase ASCII ('A'-'Z') to lowercase ('a'-'z') with a single instruction.",
                        "End Condition: Null byte ('cmp al, 0') in MASM vs dollar sign ('cmp al, '$'') in TASM."
                    ]
                };
            }
        },

        // 19. Nested Loops / Star Pattern
        {
            id: 'star_pattern',
            match: (t) => /star.*pattern|triangle.*pattern|nested\s*loop|print.*stars/i.test(t),
            generate: (prompt) => {
                const nums = parseNumbers(prompt);
                const rows = nums[0] !== undefined ? Math.min(Math.max(nums[0], 3), 9) : 5;
                return {
                    title: `Print Right-Angle Star (*) Pattern (${rows} Rows)`,
                    analysis: `Uses nested loops where outer loop runs through row indices (1 to N) and inner loop prints that many star characters per row.`,
                    masm: `INCLUDE Irvine32.inc

.data
    rows = ${rows}

.code
main PROC
    mov ecx, 1              ; Row index (1 .. rows)

row_loop:
    push ecx                ; Save current row number
    mov ebx, ecx            ; Inner counter = current row number

col_loop:
    mov al, '*'
    call WriteChar
    dec ebx
    jnz col_loop

    call Crlf               ; Newline after row

    pop ecx                 ; Restore row number
    inc ecx
    cmp ecx, rows
    jle row_loop

    exit
main ENDP
END main`,
                    tasm: `.model small
.stack 100h

.data
    rows EQU ${rows}

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov cx, 1               ; Row counter (1 .. rows)

row_loop:
    push cx                 ; Save outer counter
    mov bx, cx              ; Inner counter = row number

col_loop:
    mov dl, '*'
    mov ah, 02h             ; Print single character in DL
    int 21h
    dec bx
    jnz col_loop

    ; Print Newline (CR LF)
    mov dl, 0Dh
    mov ah, 02h
    int 21h
    mov dl, 0Ah
    mov ah, 02h
    int 21h

    pop cx                  ; Restore outer row
    inc cx
    cmp cx, rows
    jle row_loop

    mov ah, 4Ch
    int 21h
main ENDP
END main`,
                    differences: [
                        "Printing Character: MASM uses 'call WriteChar' with character in AL; TASM uses 'int 21h (AH=02h)' with character in DL.",
                        "Newline: MASM provides 'call Crlf'; TASM writes ASCII 0Dh (Carriage Return) and 0Ah (Line Feed) sequentially to DL."
                    ]
                };
            }
        }
    ];

    // Generic Smart Fallback Synthesizer for arbitrary statements
    function synthesizeCustomAssembly(prompt) {
        const cleaned = prompt.trim();
        const nums = parseNumbers(cleaned);
        const op1 = nums[0] !== undefined ? nums[0] : 10;
        const op2 = nums[1] !== undefined ? nums[1] : 5;

        // Detect basic arithmetic intent
        let opName = "ADD";
        let verb = "Add";
        let symbol = "+";
        if (/sub|minus|difference/i.test(cleaned)) {
            opName = "SUB"; verb = "Subtract"; symbol = "-";
        } else if (/mul|product|times/i.test(cleaned)) {
            opName = "IMUL"; verb = "Multiply"; symbol = "*";
        } else if (/div|quotient/i.test(cleaned)) {
            opName = "DIV"; verb = "Divide"; symbol = "/";
        } else if (/\bbitwise\s+and\b|\band\s+op|\bop\s+and\b/i.test(cleaned)) {
            opName = "AND"; verb = "Bitwise AND"; symbol = "&";
        } else if (/\bbitwise\s+or\b|\bor\s+op|\bop\s+or\b/i.test(cleaned)) {
            opName = "OR"; verb = "Bitwise OR"; symbol = "|";
        } else if (/xor/i.test(cleaned)) {
            opName = "XOR"; verb = "Bitwise XOR"; symbol = "^";
        }

        return {
            title: `Custom Operation: ${verb} (${op1} ${symbol} ${op2})`,
            analysis: `Generated custom assembly program matching: "${cleaned}". Performs ${verb} operation on operands and outputs registers & status.`,
            masm: `INCLUDE Irvine32.inc

.data
    val1   DWORD ${op1}
    val2   DWORD ${op2}
    result DWORD ?
    msg    BYTE "Operation Result (${op1} ${symbol} ${op2}) = ", 0

.code
main PROC
    mov eax, val1
    ${opName === 'IMUL' ? `imul eax, val2` : (opName === 'DIV' ? `mov edx, 0\n    mov ecx, val2\n    div ecx` : `${opName.toLowerCase()} eax, val2`)}
    mov result, eax

    ; Display text and integer
    mov edx, OFFSET msg
    call WriteString
    mov eax, result
    call WriteInt
    call Crlf

    ; Show CPU registers & status flags
    call DumpRegs

    exit
main ENDP
END main`,
            tasm: `.model small
.stack 100h

.data
    val1   DW ${op1}
    val2   DW ${op2}
    result DW ?
    msg    DB "Operation Result (${op1} ${symbol} ${op2}) = $"
    crlf   DB 0Dh, 0Ah, '$'

.code
main PROC
    mov ax, @data
    mov ds, ax

    mov ax, val1
    ${opName === 'IMUL' ? `imul val2` : (opName === 'DIV' ? `mov dx, 0\n    mov bx, val2\n    div bx` : `${opName.toLowerCase()} ax, val2`)}
    mov result, ax

    ; Print label
    lea dx, msg
    mov ah, 09h
    int 21h

    ; Self-contained decimal print (0 to 99)
    mov ax, result
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax

    cmp bl, 0           ; Skip leading zero if tens == 0
    je print_units
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h

print_units:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h

    ; Print newline
    lea dx, crlf
    mov ah, 09h
    int 21h

    ; Exit to DOS
    mov ah, 4Ch
    int 21h
main ENDP
END main
`,
            differences: [
                `Instruction Set: MASM executes '${opName}' with 32-bit registers (EAX); TASM executes with 16-bit registers (AX).`,
                `Memory Model: MASM uses flat memory with Irvine32 runtime; TASM requires small model with '@data' initialization.`,
                `Output: MASM calls 'WriteInt' and 'DumpRegs'; TASM utilizes DOS Interrupt 21h and custom print procedure.`
            ]
        };
    }

    /**
     * Main API: Generate MASM & TASM code from natural language prompt
     */
    function generateAssembly(prompt) {
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            prompt = "Add two numbers";
        }

        const trimmed = prompt.trim();

        // 1. Search matching template
        for (const tpl of TEMPLATES) {
            if (tpl.match(trimmed)) {
                return tpl.generate(trimmed);
            }
        }

        // 2. Fallback synthesizer
        return synthesizeCustomAssembly(trimmed);
    }

    /**
     * List all pre-trained problem domains
     */
    function getExamples() {
        return [
            "Add two numbers 15 and 27",
            "Subtract two numbers with flag check",
            "Multiply two numbers",
            "Divide 50 by 6 and show quotient and remainder",
            "Check if a number is even or odd",
            "Find largest of three numbers 45, 78, 23",
            "Count and print numbers from 1 to 10",
            "Sum and average of array [10, 20, 30, 40, 50]",
            "Find maximum element in array",
            "Reverse a string",
            "Check if a string is a palindrome",
            "Convert lowercase string to uppercase",
            "Bubble sort array in ascending order",
            "Calculate factorial of 5",
            "Generate first 7 terms of Fibonacci series",
            "Swap two numbers without third variable",
            "Linear search for value 42 in array",
            "Count vowels in a string",
            "Print right-angle star pattern 5 rows",
            "Read an integer from user and double it"
        ];
    }

    /**
     * Auto-fix any TASM code: replaces missing 'call PrintNum' with self-contained inline code
     * and guarantees proper 'END main' termination with newline for DOSBox.
     */
    function fixTasmCode(code) {
        if (!code || typeof code !== 'string') return code;
        let fixed = code;

        // 1. Replace any 'call PrintNum' with self-contained inline decimal print
        const printNumRegex = /\bcall\s+PrintNum\b/gi;
        if (printNumRegex.test(fixed)) {
            let counter = 0;
            fixed = fixed.replace(printNumRegex, () => {
                counter++;
                const suf = counter > 1 ? `_${counter}` : '';
                return `; [Auto-Fixed] Self-contained decimal print (0 to 99)
    mov bl, 10
    div bl              ; AL = tens, AH = units
    mov bx, ax
    cmp bl, 0           ; Skip leading zero if single digit
    je p_fix_units${suf}
    mov dl, bl
    add dl, '0'
    mov ah, 02h
    int 21h
p_fix_units${suf}:
    mov dl, bh
    add dl, '0'
    mov ah, 02h
    int 21h`;
            });
        }

        // 2. Remove orphan PrintNum PROC if left at bottom
        fixed = fixed.replace(/;?\s*-*\s*Procedure:\s*PrintNum[\s\S]*?PrintNum\s+ENDP/gi, '');

        // 3. Ensure 'END main' is cleanly present and followed by newline
        if (!/END\s+main/i.test(fixed)) {
            fixed = fixed.trim() + "\nEND main\n";
        } else {
            fixed = fixed.replace(/END\s+main[\s\S]*$/i, 'END main\n');
        }

        return fixed;
    }

    return {
        generate: generateAssembly,
        getExamples: getExamples,
        fixTasm: fixTasmCode,
        templates: TEMPLATES
    };
}));
