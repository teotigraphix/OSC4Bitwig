// Written by Jürgen Moßgraber - mossgrabers.de
// (c) 2014
// Licensed under GPLv3 - http://www.gnu.org/licenses/gpl.html

function OSCParser (model, receiveHost, receivePort)
{
	this.model = model;
    
    this.transport = this.model.getTransport ();
    this.trackBank = this.model.getTrackBank ();
    this.masterTrack = this.model.getMasterTrack ();
    this.scales = this.model.getScales ();
    
    this.trackBank.setIndication (true);

    this.keysTranslation = null;
    this.drumsTranslation = null;
    this.updateNoteMapping ();
    
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
	oscParts.shift (); // Remove first empty element
	if (oscParts.length == 0)
		return;
        
    var value = msg.values == null ? null : msg.values[0];

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
            this.parseDeviceValue (oscParts, value);
            break;

		case 'click':
            if (value == null)
                this.transport.toggleClick ();
            else if (value > 0)
                this.transport.setClick (value > 0);
			break;
		
		case 'stop':
            if (value == null || (value > 0 && this.transport.isPlaying))
                this.transport.play ();
			break;

		case 'play':
            if (value == null || (value > 0 && !this.transport.isPlaying))
                this.transport.play ();
			break;

		case 'restart':
            if (value == null || value > 0)
                this.transport.restart ();
			break;

		case 'repeat':
            if (value == null)
                this.transport.toggleLoop ();
            else if (value > 0)
                this.transport.setLoop (value > 0);
			break;
		
		case 'record':
            if (value == null || value > 0)
                this.transport.record ();
			break;

		case 'overdub':
            if (value == null || value > 0)
                this.transport.toggleOverdub ();
			break;

		case 'tempo':
			if (oscParts[0] == 'raw')
                this.transport.setTempo (value);
			break;

		case 'time':
            this.transport.setPosition (value);
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
            var p = oscParts.shift ();
            switch (p)
            {
                case '+':
                    if (value == 1)
                        this.trackBank.scrollScenesPageDown ();
                    break;
                case '-':
                    if (value == 1)
                        this.trackBank.scrollScenesPageUp ();
                    break;
                default:
                    var scene = parseInt (p);
                    if (!scene)
                        return;
                    switch (oscParts.shift ())
                    {
                        case 'launch':
                            this.trackBank.launchScene (scene - 1);
                            break;
                    }
                    break;
            }
            break;
            
        case 'vkb_midi':
            this.parseMidi (oscParts, value);
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

	switch (parts[0])
 	{
        case 'bank':
            parts.shift ();
            if (parts.shift () == '+')
            {
                if (this.trackBank.canScrollTracksDown ())
                    this.trackBank.scrollTracksPageDown ();
            }
            else // '-'
            {
                if (this.trackBank.canScrollTracksUp ())
                    this.trackBank.scrollTracksPageUp ();
            }
            break;
            
        case '+':
            var sel = this.trackBank.getSelectedTrack ();
            var index = sel == null ? 0 : sel.index + 1;
            if (index == 8)
            {
                if (!this.trackBank.canScrollTracksDown ())
                    return;
                this.trackBank.scrollTracksPageDown ();
                scheduleTask (doObject (this, this.selectTrack), [0], 75);
            }
            this.selectTrack (index);
            break;
            
        case '-':
            var sel = this.trackBank.getSelectedTrack ();
            var index = sel == null ? 0 : sel.index - 1;
            if (index == -1)
            {
                if (!this.trackBank.canScrollTracksUp ())
                    return;
                this.trackBank.scrollTracksPageUp ();
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
                this.masterTrack.select ();
            else
                this.trackBank.select (trackIndex);
			break;
			
		case 'volume':
            if (parts.length == 1)
            {
				var volume = parseFloat (value);
                if (trackIndex == -1)
                    this.masterTrack.setVolume (volume);
                else
                    this.trackBank.setVolume (trackIndex, volume);
            }
			break;
			
		case 'pan':
			if (parts.length == 1)
            {
				var pan = value;
                if (trackIndex == -1)
                    this.masterTrack.setPan (pan);
                else
                    this.trackBank.setPan (trackIndex, pan);
            }
			break;
			
		case 'mute':
			var mute = value == null ? null : parseInt (value);
            if (trackIndex == -1)
                if (mute == null)
                    this.masterTrack.toggleMute ();
                else
                    this.masterTrack.setMute (mute > 0);
            else
                if (mute == null)
                    this.trackBank.toggleMute (trackIndex);
                else
                    this.trackBank.setMute (trackIndex, mute > 0);
			break;
			
		case 'solo':
			var solo = value == null ? null : parseInt (value);
            if (trackIndex == -1)
                if (solo == null)
                    this.masterTrack.toggleSolo ();
                else
                    this.masterTrack.setSolo (solo > 0);
            else
                if (solo == null)
                    this.trackBank.toggleSolo (trackIndex);
                else
                    this.trackBank.setSolo (trackIndex, solo > 0);
			break;
			
		case 'recarm':
			var recarm = value == null ? null : parseInt (value);
            if (trackIndex == -1)
                if (recarm == null)
                    this.masterTrack.toggleArm ();
                else
                    this.masterTrack.setArm (recarm > 0);
            else
                if (recarm == null)
                    this.trackBank.toggleArm (trackIndex);
                else
                    this.trackBank.setArm (trackIndex, recarm > 0);
			break;
			
		case 'autowrite':
            // Note: Can only be activated globally
            this.transport.toggleWriteArrangerAutomation ();
			break;
			
		case 'send':
			parts.shift ();
			var sendNo = parseInt (parts.shift ());
			if (isNaN (sendNo))
				return;
			this.parseSendValue (trackIndex, sendNo - 1, parts, value);
			break;
            
        case 'clip':
			parts.shift ();
			var clipNo = parseInt (parts.shift ());
			if (isNaN (clipNo))
				return;
			this.trackBank.getClipLauncherSlots (trackIndex).launch (clipNo - 1);
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
            this.trackBank.setSend (trackIndex, sendIndex, value);
			break;

        default:
			println ('Unhandled Send Parameter value: ' + parts[0]);
			break;
	}
};

OSCParser.prototype.parseDeviceValue = function (parts, value)
{
    var cd = this.model.getCursorDevice ();
    
    var p = parts.shift ();
    switch (p)
    {
        case '+':
            cd.selectNext ();
            break;

        case '-':
            cd.selectPrevious ();
            break;

        case 'params':
            switch (parts.shift ())
            {
                case '+':
                    cd.nextParameterPage ();
                    break;
                case '-':
                    cd.previousParameterPage ();
                    break;
            }
            break;

        case 'preset':
            switch (parts.shift ())
            {
                case '+':
                    cd.switchToNextPreset ();
                    break;
                case '-':
                    cd.switchToPreviousPreset ();
                    break;
            }
            break;

        case 'category':
            switch (parts.shift ())
            {
                case '+':
                    cd.switchToNextPresetCategory ();
                    break;
                case '-':
                    cd.switchToPreviousPresetCategory ();
                    break;
            }
            break;

        case 'creator':
            switch (parts.shift ())
            {
                case '+':
                    cd.switchToNextPresetCreator ();
                    break;
                case '-':
                    cd.switchToPreviousPresetCreator ();
                    break;
            }
            break;

        default:
			println ('Unhandled Device Parameter: ' + p);
			break;
    }
};

OSCParser.prototype.parseMidi = function (parts, value)
{
    var midiChannel = parseInt (parts.shift ());
    var p = parts.shift ();
    switch (p)
    {
        case 'note':
            var n = parts.shift ();
            switch (n)
            {
                case '+':
                    if (!value)
                        return;
                    this.scales.incOctave ();
                    this.updateNoteMapping ();
                    break;
            
                case '-':
                    if (!value)
                        return;
                    this.scales.decOctave ();
                    this.updateNoteMapping ();
                    break;
            
                default:
                    var note = parseInt (n);
                    var velocity = parseInt (value);
                    this.noteInput.sendRawMidiEvent (0x90 + midiChannel, this.keysTranslation[note], velocity);
            }
            break;
            
        case 'drum':
            var n = parts.shift ();
            switch (n)
            {
                case '+':
                    if (!value)
                        return;
                    this.scales.incDrumOctave ();
                    this.updateNoteMapping ();
                    break;
            
                case '-':
                    if (!value)
                        return;
                    this.scales.decDrumOctave ();
                    this.updateNoteMapping ();
                    break;
            
                default:
                    var note = parseInt (n);
                    var velocity = parseInt (value);
                    this.noteInput.sendRawMidiEvent (0x90 + midiChannel, this.drumsTranslation[note], velocity);
            }
            break;
            
        default:
			println ('Unhandled Midi Parameter: ' + p);
            break;
    }
};

OSCParser.prototype.updateNoteMapping = function ()
{
    this.drumsTranslation = this.scales.getDrumMatrix ();
    this.keysTranslation = this.scales.getNoteMatrix (); 
};

OSCParser.prototype.selectTrack = function (index)
{
    this.trackBank.select (index);
};
