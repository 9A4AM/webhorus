from crc import Calculator,  Configuration

class predefined():
    def mkCrcFun(type):
        calculator = Calculator(Configuration(
            16, 0x1021,0xffff
        ))
        if type == 'crc-ccitt-false':
            def check(data):
                return calculator.checksum(data)
        return check