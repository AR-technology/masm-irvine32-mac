INCLUDE Irvine32.inc

.data
    prompt1 BYTE "Enter first number: ", 0
    prompt2 BYTE "Enter second number: ", 0
    resMsg  BYTE "Sum = ", 0
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
    add eax, num2

    ; 4. Display result
    mov edx, OFFSET resMsg
    call WriteString
    call WriteInt
    call Crlf

    exit
main ENDP
END main