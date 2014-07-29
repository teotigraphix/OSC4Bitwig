// Written by Jürgen Moßgraber - mossgrabers.de
// (c) 2014
// Licensed under GPLv3 - http://www.gnu.org/licenses/gpl.html

function OSCParser (model, receiveHost, receivePort)
{
	this.model = model;
    
    this.port = host.getMidiInPort (0);
    this.noteInput = this.port.createNoteInput ("OSC Midi");

    host.addDatagramPacketObserver (receiveHost, receivePort, doObject (this, function (data)
    {
        var msg = new OSCMessage ();
        msg.parse (data);

        /*
        println ("Address: " + msg.address);
        println ("Types: " + msg.types);
        println ("Values: " + msg.values);
        */

        this.parse (msg);
    }));
}

OSCParser.prototype.parse = function (msg)
{
	var oscParts = msg.address.split ('/');
	if (oscParts.length < 2)
		return;
        
    var value = msg.values == null ? null : msg.values[0];

	oscParts.shift (); // Remove first empty element
	switch (oscParts.shift ())
	{
		case 'track':
			var trackNo = parseInt (oscParts[0]);
			if (isNaN (trackNo))
            {
                this.parseTrackCommands (oscParts, value);
				return;
            }
			oscParts.shift ();
			this.parseTrackValue (trackNo - 1, oscParts, value);
			break;

		case 'master':
			this.parseTrackValue (-1, oscParts, value);
			break;
            
        case 'device':
            if (value != null && value == 0)
                return;
            switch (oscParts.shift ())
            {
                case '+':
                    this.model.getCursorDevice ().selectNext ();
                    break;
                case '-':
                    this.model.getCursorDevice ().selectPrevious ();
                    break;
                case 'params':
                    switch (oscParts.shift ())
                    {
                        case '+':
                            this.model.getCursorDevice ().nextParameterPage ();
                            break;
                        case '-':
                            this.model.getCursorDevice ().previousParameterPage ();
                            break;
                    }
                    break;
                case 'preset':
                    switch (oscParts.shift ())
                    {
                        case '+':
                            this.model.getCursorDevice ().switchToNextPreset ();
                            break;
                        case '-':
                            this.model.getCursorDevice ().switchToPreviousPreset ();
                            break;
                    }
                    break;
                case 'category':
                    switch (oscParts.shift ())
                    {
                        case '+':
                            this.model.getCursorDevice ().switchToNextPresetCategory ();
                            break;
                        case '-':
                            this.model.getCursorDevice ().switchToPreviousPresetCategory ();
                            break;
                    }
                    break;
                case 'creator':
                    switch (oscParts.shift ())
                    {
                        case '+':
                            this.model.getCursorDevice ().switchToNextPresetCreator ();
                            break;
                        case '-':
                            this.model.getCursorDevice ().switchToPreviousPresetCreator ();
                            break;
                    }
                    break;
            }
            break;

		case 'click':
            if (value == null)
                this.model.getTransport ().toggleClick ();
            else if (value > 0)
                this.model.getTransport ().setClick (value > 0);
			break;
		
		case 'stop':
            var t = this.model.getTransport ();
            if (value == null || (value > 0 && t.isPlaying))
                t.play ();
			break;

		case 'play':
            var t = this.model.getTransport ();
            if (value == null || (value > 0 && !t.isPlaying))
                t.play ();
			break;

		case 'restart':
            var t = this.model.getTransport ();
            if (value == null || value > 0)
                t.restart ();
			break;

		case 'repeat':
            if (value == null)
                this.model.getTransport ().toggleLoop ();
            else if (value > 0)
                this.model.getTransport ().setLoop (value > 0);
			break;
		
		case 'record':
            if (value == null || value > 0)
                this.model.getTransport ().record ();
			break;

		case 'overdub':
            if (value == null || value > 0)
                this.model.getTransport ().toggleOverdub ();
			break;

		case 'tempo':
			if (oscParts[0] == 'raw')
                this.model.getTransport ().setTempo (value);
			break;

		case 'time':
            this.model.getTransport ().setPosition (value);
			break;

		case 'fx':
            /* Currently, we only have the cursor device
			var fxNo = parseInt (oscParts[0]);
			if (isNaN (fxNo))
				return;
			oscParts.shift ();*/
			this.parseFXValue (oscParts, value);
			break;

		case 'fxparam':
			var fxParamNo = parseInt (oscParts[0]);
			if (isNaN (fxParamNo))
				return;
			oscParts.shift ();
			this.parseFXParamValue (fxParamNo - 1, oscParts, value);
			break;
            
        case 'scene':
            if (value != null && value == 0)
                return;
            switch (oscParts.shift ())
            {
                case '+':
                    this.model.getTrackBank ().scrollScenesUp ();
                    break;
                case '-':
                    this.model.getTrackBank ().scrollScenesDown ();
                    break;
            }
            break;
            
        case 'vkb_midi':
			var midiChannel = parseInt (oscParts.shift ());
            
            switch (oscParts.shift ())
            {
                case 'note':
                    var note = parseInt (oscParts.shift ());
                    var velocity = parseInt (value);
                    this.noteInput.sendRawMidiEvent (0x90 + midiChannel, note, velocity);
                    break;
            }
            
            break;
		
		default:
			println ('Unhandled OSC Command: ' + msg.address + ' ' + value);
			break;
	}
};

OSCParser.prototype.parseTrackCommands = function (parts, value)
{
    if (value != null && value == 0)
        return;
    var tb = this.model.getTrackBank ();

	switch (parts[0])
 	{
        case 'bank':
            parts.shift ();
            if (parts.shift () == '+')
            {
                if (tb.canScrollTracksDown ())
                    tb.scrollTracksPageDown ();
            }
            else // '-'
            {
                if (tb.canScrollTracksUp ())
                    tb.scrollTracksPageUp ();
            }
            break;
            
        case '+':
            var sel = tb.getSelectedTrack ();
            var index = sel == null ? 0 : sel.index + 1;
            if (index == 8)
            {
                if (!tb.canScrollTracksDown ())
                    return;
                tb.scrollTracksPageDown ();
                scheduleTask (doObject (this, this.selectTrack), [0], 75);
            }
            this.selectTrack (index);
            break;
            
        case '-':
            var sel = tb.getSelectedTrack ();
            var index = sel == null ? 0 : sel.index - 1;
            if (index == -1)
            {
                if (!tb.canScrollTracksUp ())
                    return;
                tb.scrollTracksPageUp ();
                scheduleTask (doObject (this, this.selectTrack), [7], 75);
                return;
            }
            this.selectTrack (index);
            break;
            
		default:
			println ('Unhandled Track Command: ' + parts[0]);
			break;
    }
}

OSCParser.prototype.parseTrackValue = function (trackIndex, parts, value)
{
	switch (parts[0])
 	{
		case 'select':
            if (value && value == 0)
                return;
            if (trackIndex == -1)
                this.model.getMasterTrack ().select ();
            else
                this.model.getTrackBank ().select (trackIndex);
			break;
			
		case 'volume':
            if (parts.length == 1)
            {
				var volume = parseFloat (value);
                if (trackIndex == -1)
                    this.model.getMasterTrack ().setVolume (volume);
                else
                    this.model.getTrackBank ().setVolume (trackIndex, volume);
            }
			break;
			
		case 'pan':
			if (parts.length == 1)
            {
				var pan = value;
                if (trackIndex == -1)
                    this.model.getMasterTrack ().setPan (pan);
                else
                    this.model.getTrackBank ().setPan (trackIndex, pan);
            }
			break;
			
		case 'mute':
			var mute = value == null ? null : parseInt (value);
            if (trackIndex == -1)
                if (mute == null)
                    this.model.getMasterTrack ().toggleMute ();
                else
                    this.model.getMasterTrack ().setMute (mute > 0);
            else
                if (mute == null)
                    this.model.getTrackBank ().toggleMute (trackIndex);
                else
                    this.model.getTrackBank ().setMute (trackIndex, mute > 0);
			break;
			
		case 'solo':
			var solo = value == null ? null : parseInt (value);
            if (trackIndex == -1)
                if (solo == null)
                    this.model.getMasterTrack ().toggleSolo ();
                else
                    this.model.getMasterTrack ().setSolo (solo > 0);
            else
                if (solo == null)
                    this.model.getTrackBank ().toggleSolo (trackIndex);
                else
                    this.model.getTrackBank ().setSolo (trackIndex, solo > 0);
			break;
			
		case 'recarm':
			var recarm = value == null ? null : parseInt (value);
            if (trackIndex == -1)
                if (recarm == null)
                    this.model.getMasterTrack ().toggleArm ();
                else
                    this.model.getMasterTrack ().setArm (recarm > 0);
            else
                if (recarm == null)
                    this.model.getTrackBank ().toggleArm (trackIndex);
                else
                    this.model.getTrackBank ().setArm (trackIndex, recarm > 0);
			break;
			
		case 'autowrite':
            // Note: Can only be activated globally
            this.model.getTransport ().toggleWriteArrangerAutomation ();
			break;
			
		case 'send':
			parts.shift ();
			var sendNo = parseInt (parts.shift ());
			if (isNaN (sendNo))
				return;
			this.parseSendValue (trackIndex, sendNo - 1, parts, value);
			break;
            
		default:
			println ('Unhandled Track Parameter: ' + parts[0]);
			break;
	}
};

OSCParser.prototype.parseFXValue = function (parts, value)
{
	switch (parts[0])
 	{
		case 'bypass':
            this.model.getCursorDevice ().toggleEnabledState ();
			break;
			
		case 'openui':
            // Can not open VST UIs...
			break;
			
		default:
			println ('Unhandled FX value: ' + parts[0]);
			break;
	}
};

OSCParser.prototype.parseFXParamValue = function (fxparamIndex, parts, value)
{
	switch (parts[0])
 	{
		case 'value':
			if (parts.length == 1)
				this.model.getCursorDevice ().setParameter (fxparamIndex, parseFloat (value));
			break;

        default:
			println ('Unhandled FX Parameter value: ' + parts[0]);
			break;
	}
};

OSCParser.prototype.parseSendValue = function (trackIndex, sendIndex, parts, value)
{
	switch (parts[0])
 	{
		case 'volume':
            this.model.getTrackBank ().setSend (trackIndex, sendIndex, value);
			break;
            
        default:
			println ('Unhandled Send Parameter value: ' + parts[0]);
			break;
	}
};

OSCParser.prototype.selectTrack = function (index)
{
    this.model.getTrackBank ().select (index);
};
