// Written by Jürgen Moßgraber - mossgrabers.de
// (c) 2014
// Licensed under GPLv3 - http://www.gnu.org/licenses/gpl.html

function OSCMessage ()
{
    this.address = "";
    this.types   = null;
    this.values  = [];
    this.data    = null;
}

OSCMessage.prototype.init = function (address, param)
{
    this.address = address;
    this.types = [];
    if (param != null)
    {
        switch (typeof (param))
        {
            case 'string':
                this.types.push ('s');
                this.values.push (param);
                break;

            case 'boolean':
                this.types.push (param ? 'T' : 'F');
                break;

            case 'number':
                if (param % 1 === 0) // Is Integer ?
                    this.types.push ('i');
                else
                    this.types.push ('f');
                this.values.push (param);
                break;

            default:
                println ("Unsupported object type: " + typeof (param));
                break;
        }
    }
    else
        this.types.push ('N');
};

OSCMessage.prototype.parse = function (data)
{
    this.data = data;
    this.streamPos = 0;
    
    this.address = this.readString ();
    this.streamPos = this.address.length;
    
    this.skipToFourByteBoundary ();
    
    this.types = this.readTypes ();
    if (this.types == null)
        return;
    
    this.skipToFourByteBoundary ();
    
	for (var i = 0; i < this.types.length; i++)
    {
        if (this.types[i] == '[')
        {
            // This is an array -> read it
            this.values.push (this.readArray (this.types, ++i));
            // Increment i to the end of the array
            while (this.types[i] != ']')
                i++;
        } 
        else
            this.values.push (this.readArgument (this.types[i]));

        this.skipToFourByteBoundary ();
    }
};

OSCMessage.prototype.build = function ()
{
    this.data = [];

    this.writeString (this.address);
    this.alignToFourByteBoundary ();
    
    this.data.push (','.charCodeAt (0));
    for (var i = 0; i < this.types.length; i++)
        this.data.push (this.types[i].charCodeAt (0));
    this.alignToFourByteBoundary ();
    
    for (var i = 0; i < this.values.length; i++)
    {
        switch (this.types[i])
        {
            case 's':
                this.writeString (this.values[i]);
                break;
                
            case 'i':
                this.writeInteger (this.values[i]);
                break;
                
            case 'f':
                this.writeFloat (this.values[i]);
                break;
        }
        this.alignToFourByteBoundary ();
    }
    
    return this.data;
}



//
// PRIVATE
//

OSCMessage.prototype.readTypes = function ()
{
    // No arguments ?
    if (this.data.length <= this.streamPos)
        return null;

    // The next byte should be a ',', but some legacy code may omit it
    // in case of no arguments, referring to "OSC Messages" in:
    // http://opensoundcontrol.org/spec-1_0
    if (String.fromCharCode (this.data[this.streamPos]) != ',')
        return null;

    this.streamPos++;
    
    // Read in the types
    var types = this.readString ();
    // No arguments
    if (types.length == 0)
        return null;
    
    var typesChars = [];
    for (var i = 0; i < types.length; i++) 
        typesChars.push (types[i]);
    this.streamPos += types.length;
    return typesChars;
};

OSCMessage.prototype.readArgument = function (type)
{
    switch (type)
    {
        case 'u':
            return this.readUnsignedInteger ();
        case 'i':
            return this.readInteger ();
        case 'h':
            return this.readLong ();
        case 'f':
            return this.readFloat ();
        case 'd':
            return this.readDouble ();
        case 'c':
        case 's':
            return this.readString ();
        case 'b':
            return this.readBlob ();
        case 'N':
            return null;
        case 'T':
            return true;
        case 'F':
            return false;
        case 'I':
            return Number.POSITIVE_INFINITY;
        case 't':
            return this.readTimeTag ();
        case 'm':
            return this.readMidi ();
        default:
            println ("Invalid or not yet supported OSC type: '" + type + "'");
            return null;
    }
}

OSCMessage.prototype.readUnsignedInteger = function ()
{
    // TODO
    return "TODO";
};

OSCMessage.prototype.readInteger = function ()
{
    return this.readBigInteger (4);
};

OSCMessage.prototype.writeInteger = function (value)
{
    var pos = this.data.length;
    for (var i = 0; i < 4; i++)
    {
        this.data[pos + 3 - i] = value & 255;
        value = value >> 8;
    }
};

OSCMessage.prototype.readLong = function ()
{
    return this.readBigInteger (8);
};

OSCMessage.prototype.readBigInteger = function (numberOfBytes)
{
    var value = 0;
    for (var i = this.streamPos; i < this.streamPos + numberOfBytes; i++)
        value = value * 256 + (this.data[i] < 0 ? 256 + this.data[i] : this.data[i]);
    this.streamPos += numberOfBytes;
    return value;
};

OSCMessage.prototype.readFloat = function ()
{
    var sign = (this.data[this.streamPos] & 0x80) ? -1 : 1;
    var exponent = this.data[this.streamPos] & 0x7F;
	exponent = exponent << 1;
			
    if ((this.data[this.streamPos + 1] & 0x80) != 0)
        exponent += 0x01;
    if (exponent != 0)
        exponent = Math.pow (2, exponent - 127);

    var num = 0;
    var mask = 0x40;
    for (var i = 1; i < 8; i++)
    {
        if ((this.data[this.streamPos + 1] & mask) != 0)
            num += 1 / Math.pow (2, i);
        mask = mask >> 1;
    }
    mask = 0x80;
    for (var j = 0; j < 8; j++)
    {
        if((this.data[this.streamPos + 2] & mask) != 0)
            num += 1 / Math.pow (2, j + 8);
        mask = mask >> 1;
    }
    mask = 0x80;
    for (var k = 0; k < 8; k++)
    {
        if ((this.data[this.streamPos + 2] & mask) != 0)
            num += 1 / Math.pow (2, k + 16);
        mask = mask >> 1;
    }
    var significand = num + 1;    
    
    this.streamPos += 4;

    return sign * significand * exponent;
};

OSCMessage.prototype.writeFloat = function ()
{
    // TODO
};

OSCMessage.prototype.readDouble = function ()
{
    // TODO
    return "TODO";
};

OSCMessage.prototype.readString = function ()
{
    var pos = this.streamPos;
    var str = "";
    while (pos < this.data.length && this.data[pos] != 0)
    {
        str += String.fromCharCode (this.data[pos]);
        pos++;
    }
    return str;
};

OSCMessage.prototype.writeString = function (str)
{
    for (var i = 0; i < str.length; i++)
        this.data.push (str.charCodeAt (i));
};

OSCMessage.prototype.readBlob = function ()
{
    // TODO
    return "TODO";
};

OSCMessage.prototype.readTimeTag = function ()
{
    // TODO
    return "TODO";
};

OSCMessage.prototype.readMidi = function ()
{
    // 4 byte MIDI message. Bytes from MSB to LSB are: port id, status byte, data1, data2
    // TODO
    return "TODO";
};

OSCMessage.prototype.skipToFourByteBoundary = function ()
{
    // If we are already at a 4 byte boundary, we need to move to the next one
    var mod = this.streamPos % 4;
    this.streamPos += (4 - mod);
};

OSCMessage.prototype.alignToFourByteBoundary = function ()
{
    var upper = 4 - (this.data.length % 4);
	for (var i = 0; i < upper; i++)
        this.data.push (0);
};
