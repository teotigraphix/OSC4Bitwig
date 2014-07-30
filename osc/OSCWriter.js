// Written by Jürgen Moßgraber - mossgrabers.de
// (c) 2014
// Licensed under GPLv3 - http://www.gnu.org/licenses/gpl.html

OSCWriter.TRACK_ATTRIBS = [ "selected", "name", "volumeStr", "volume", "vu", "mute", "solo", "recarm", "panStr", "pan", "sends", "slots" ];
OSCWriter.FXPARAM_ATTRIBS = [ "name", "valueStr", "value" ];

function OSCWriter (model, oscHost, oscPort)
{
    this.oscHost = oscHost;
    this.oscPort = oscPort;
    
    this.model = model;
    
    var tb = this.model.getTrackBank ();
	this.oldTracks = tb.createTracks (8);
	this.oldMasterTrack = tb.createTracks (1)[0];
    this.oldFXParams = this.model.getCursorDevice ().createFXParams (8);
    this.isClickOn   = false;
    this.isPlaying   = false;
    this.isRecording = false;
    
    this.messages = [];
}

OSCWriter.prototype.flush = function (dump)
{
	this.sendOSC ('/update', true);
    
	var tb = this.model.getTrackBank ();
	for (var i = 0; i < 8; i++)
        this.flushTrack ('/track/' + (i + 1) + '/', tb.getTrack (i), this.oldTracks[i], dump);
    this.flushTrack ('/master/', this.model.getMasterTrack (), this.oldMasterTrack, dump);
    
    var cd = this.model.getCursorDevice ();
	for (var i = 0; i < 8; i++)
        this.flushFX ('/fxparam/' + (i + 1) + '/', cd.getFXParam (i), this.oldFXParams[i], dump);
    
    var trans = this.model.getTransport ();
    if (this.isClickOn != trans.isClickOn || dump)
    {
        this.sendOSC ('/click', trans.isClickOn);
        this.isClickOn = trans.isClickOn;
    }
    if (this.isPlaying != trans.isPlaying || dump)
    {
        this.sendOSC ('/play', trans.isPlaying || dump);
        this.isPlaying = trans.isPlaying;
    }
    if (this.isRecording != trans.isRecording || dump)
    {
        this.sendOSC ('/record', trans.isRecording);
        this.isRecording = trans.isRecording;
    }
    
	this.sendOSC ('/update', false);
    
    if (this.messages.length <= 2)
    {
        this.messages = [];
        return;
	}
    
    while (msg = this.messages.shift ())
        host.sendDatagramPacket (this.oscHost, this.oscPort, msg);
};

OSCWriter.prototype.flushTrack = function (trackAddress, track, oldTrack, dump)
{
    for (var a = 0; a < OSCWriter.TRACK_ATTRIBS.length; a++)
    {
        var p = OSCWriter.TRACK_ATTRIBS[a];
        switch (p)
        {
            case 'sends':
                if (!track.sends)
                    continue;
                for (var j = 0; j < 6; j++)
                {
                    var s = track.sends[j];
                    var os = oldTrack.sends[j];
                    for (var q in s)
                    {
                        if (s[q] != os[q] || dump)
                        {
                            this.sendOSC (trackAddress + 'send/' + j + '/' + q, s[q]);
                            os[q] = s[q];
                        }
                    }
                }
                break;
                
            case 'slots':
                if (!track.slots)
                    continue;
                for (var j = 0; j < 8; j++)
                {
                    var s = track.slots[j];
                    var os = oldTrack.slots[j];
                    for (var q in s)
                    {
                        if (s[q] != os[q] || dump)
                        {
                            this.sendOSC (trackAddress + 'slot/' + j + '/' + q, s[q]);
                            os[q] = s[q];
                        }
                    }
                }
                break;
                
            default:
                if (track[p] != oldTrack[p] || dump)
                {
                    this.sendOSC (trackAddress + p, track[p]);
                    oldTrack[p] = track[p];
                }
                break;
        }
	}
};

OSCWriter.prototype.flushFX = function (fxAddress, fxParam, oldFxParam, dump)
{
    for (var a = 0; a < OSCWriter.FXPARAM_ATTRIBS.length; a++)
    {
        var p = OSCWriter.FXPARAM_ATTRIBS[a];
        if (fxParam[p] != oldFxParam[p] || dump)
        {
            this.sendOSC (fxAddress + p, fxParam[p]);
            oldFxParam[p] = fxParam[p];
        }
	}
};

OSCWriter.prototype.sendOSC = function (address, value)
{
    var msg = new OSCMessage ();
    msg.init (address, value);
    this.messages.push (msg.build ());
};
