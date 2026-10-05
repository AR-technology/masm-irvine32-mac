/**
 * Assembly Lab Templates & Preloaded Examples
 */

const LAB_TEMPLATES = {
    "default": {
        name: "Standard Template (main.asm)",
        description: "Clean starter template for standard Irvine32 MASM labs",
        code: `; -------------------------------------------------------------
; Lab Project: Template
; Description: Standard Irvine32 Template
; -------------------------------------------------------------
INCLUDE Irvine32.inc

.data
    myMsg BYTE "Hello from MASM x86 on macOS!", 0dh, 0ah, 0
    val1  DWORD 10h
    val2  DWORD 20h
    final DWORD ?

.code
main PROC
    ; 1. Display welcome string
    mov edx, OFFSET myMsg
    call WriteString

    ; 2. Perform register arithmetic
    mov eax, val1
    add eax, val2
    mov final, eax

    ; 3. Dump registers to inspect final state
    call DumpRegs

    exit
main ENDP
END main
`
    },

    "lab1": {
        name: "Lab 1: Registers & Add/Sub",
        description: "Practice moving data between registers, ADD, SUB, and DumpRegs",
        code: `; -------------------------------------------------------------
; Lab 1: Data Transfer and Basic Arithmetic
; Objective: Experiment with EAX, EBX, ECX, EDX, ADD and SUB
; -------------------------------------------------------------
INCLUDE Irvine32.inc

.data
    prompt BYTE "--- Lab 1: Register Arithmetic ---", 0dh, 0ah, 0

.code
main PROC
    mov edx, OFFSET prompt
    call WriteString

    ; Initialize registers with hex values
    mov eax, 1000h
    mov ebx, 2000h
    mov ecx, 3000h
    mov edx, 4000h

    ; Perform operations: EAX = (EAX + EBX) - (ECX - EDX)
    add eax, ebx
    sub ecx, edx
    sub eax, ecx

    ; Display all registers and flags
    call DumpRegs

    exit
main ENDP
END main
`
    },

    "lab2": {
        name: "Lab 2: Variables & Memory Offsets",
        description: "Data segment declarations (BYTE, WORD, DWORD) & OFFSET operator",
        code: `; -------------------------------------------------------------
; Lab 2: Memory Variables and Addressing
; Objective: Accessing arrays, offsets, and data types
; -------------------------------------------------------------
INCLUDE Irvine32.inc

.data
    valA DWORD 55AA1122h
    valB WORD  1234h
    valC BYTE  0FFh
    
    arrayD DWORD 10, 20, 30, 40, 50
    msgSum BYTE "Sum of array elements: ", 0

.code
main PROC
    ; Load memory address of array into ESI
    mov esi, OFFSET arrayD
    
    ; Compute sum of array elements using indexed addressing
    mov eax, [esi]          ; 1st element (10)
    add eax, [esi + 4]      ; 2nd element (20)
    add eax, [esi + 8]      ; 3rd element (30)
    add eax, [esi + 12]     ; 4th element (40)
    add eax, [esi + 16]     ; 5th element (50)

    ; Print result string and calculated sum
    mov edx, OFFSET msgSum
    call WriteString
    call WriteDec
    call Crlf
    call Crlf

    call DumpRegs

    exit
main ENDP
END main
`
    },

    "lab3": {
        name: "Lab 3: Loops & Array Traversal",
        description: "Using ECX counter and the LOOP instruction to iterate through data",
        code: `; -------------------------------------------------------------
; Lab 3: Loop Instruction and Array Processing
; Objective: Compute total and average using the LOOP instruction
; -------------------------------------------------------------
INCLUDE Irvine32.inc

.data
    scores DWORD 85, 92, 78, 90, 88
    count  DWORD 5
    strTotal BYTE "Total Score: ", 0
    strAvg   BYTE "Average Score: ", 0

.code
main PROC
    mov esi, OFFSET scores
    mov ecx, count          ; Loop counter in ECX
    mov eax, 0              ; Clear accumulator

L1:
    add eax, [esi]          ; Add current element
    add esi, TYPE scores    ; Advance pointer by 4 bytes (DWORD)
    loop L1

    ; Print total
    mov edx, OFFSET strTotal
    call WriteString
    call WriteDec
    call Crlf

    ; Calculate average: EAX / count
    mov edx, 0              ; Clear EDX before 32-bit division
    mov ebx, count
    div ebx                 ; Quotient is in EAX, Remainder in EDX

    mov edx, OFFSET strAvg
    call WriteString
    call WriteDec
    call Crlf

    exit
main ENDP
END main
`
    },

    "lab4": {
        name: "Lab 4: User Input & Console I/O",
        description: "Interactive I/O with ReadInt, WriteInt, WriteString, and Crlf",
        code: `; -------------------------------------------------------------
; Lab 4: Interactive Console I/O
; Objective: Prompt user for 2 integers and print their product
; -------------------------------------------------------------
INCLUDE Irvine32.inc

.data
    prompt1 BYTE "Enter first number: ", 0
    prompt2 BYTE "Enter second number: ", 0
    resMsg  BYTE "Result (Number 1 * Number 2) = ", 0
    num1    DWORD ?
    num2    DWORD ?

.code
main PROC
    ; Read first integer
    mov edx, OFFSET prompt1
    call WriteString
    call ReadInt
    mov num1, eax

    ; Read second integer
    mov edx, OFFSET prompt2
    call WriteString
    call ReadInt
    mov num2, eax

    ; Multiply numbers: EAX = num1 * num2
    mov eax, num1
    imul eax, num2

    ; Print Result
    mov edx, OFFSET resMsg
    call WriteString
    call WriteInt
    call Crlf

    exit
main ENDP
END main
`
    },

    "lab5": {
        name: "Lab 5: Conditional Jumps & CMP",
        description: "Decision making using CMP, JE, JL, JG, and JMP",
        code: `; -------------------------------------------------------------
; Lab 5: Conditionals and Comparison
; Objective: Find the maximum of two numbers
; -------------------------------------------------------------
INCLUDE Irvine32.inc

.data
    promptA BYTE "Enter value A: ", 0
    promptB BYTE "Enter value B: ", 0
    msgMax  BYTE "The larger value is: ", 0
    valA    DWORD ?
    valB    DWORD ?

.code
main PROC
    mov edx, OFFSET promptA
    call WriteString
    call ReadInt
    mov valA, eax

    mov edx, OFFSET promptB
    call WriteString
    call ReadInt
    mov valB, eax

    ; Compare valA (EAX) with valB
    mov eax, valA
    cmp eax, valB
    jge AisLarger

BisLarger:
    mov eax, valB
    jmp PrintResult

AisLarger:
    ; EAX already holds valA

PrintResult:
    mov edx, OFFSET msgMax
    call WriteString
    call WriteInt
    call Crlf

    exit
main ENDP
END main
`
    },

    "lab6": {
        name: "Lab 6: Procedures & Call / Ret Stack",
        description: "Defining custom procedures, parameter passing, and CALL/RET",
        code: `; -------------------------------------------------------------
; Lab 6: Subroutines and Stack Frames
; Objective: Create a custom procedure to compute power (base ^ exp)
; -------------------------------------------------------------
INCLUDE Irvine32.inc

.data
    msgResult BYTE "2 ^ 8 = ", 0

.code
main PROC
    mov ebx, 2              ; Base
    mov ecx, 8              ; Exponent
    call ComputePower       ; Call procedure (returns result in EAX)

    mov edx, OFFSET msgResult
    call WriteString
    call WriteDec
    call Crlf
    call DumpRegs

    exit
main ENDP

; Procedure: ComputePower
; Receives: EBX = Base, ECX = Exponent
; Returns:  EAX = (Base ^ Exponent)
ComputePower PROC
    mov eax, 1
PowLoop:
    imul eax, ebx
    loop PowLoop
    ret
ComputePower ENDP

END main
`
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LAB_TEMPLATES;
}
