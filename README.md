OSC4Bitwig
===========

Bitwig Studio script to support the OSC protocol.


The following OSC messages are sent from the script
---------------------------------------------------

/update {1,0}       Indicates the transmission of several OSC messages

/click {1,0}
/play {1,0}
/record {1,0}

/track/{1-8}/select
/track/{1-8}/volume {0-127}
/track/{1-8}/volumeStr {text}
/track/{1-8}/pan {0-127}
/track/{1-8}/panStr {text}
/track/{1-8}/mute {1,0}
/track/{1-8}/solo {1,0}
/track/{1-8}/recarm {1,0}
/track/{1-8}/send/{S}/volume {0-127}
/track/{1-8}/send/{S}/volumeStr {text}
/track/{1-8}/slot/{S}/isSelected {1,0}

/master/...         as above, except sends & slots


The following OSC messages can be received by the script
--------------------------------------------------------

/click {1,-}        1 = Enable, No value = Toggle
/stop {1,-}
/play {1,-}
/restart {1,-}
/repeat {1,-}
/record {1,-}
/overdub {1,-}

/tempo/raw {0-666}

/track/bank/+
/track/bank/-
/track/+
/track/-

/track/{1-8}/select
/track/{1-8}/volume {0-127}
/track/{1-8}/pan {0-127}
/track/{1-8}/mute {1,0,-}
/track/{1-8}/solo {1,0,-}
/track/{1-8}/recarm {1,0,-}
/track/{1-8}/autowrite - Only toggles globally
/track/{1-8}/send/{S}/volume {0-127}

/master/... (as above, except sends)

/device/+
/device/-
/device/params/+
/device/params/-
/device/preset/+
/device/preset/-
/device/category/+
/device/category/-
/device/creator/+
/device/creator/-

/fx/bypass
/fxparam/{1-8}/value {0-127}

/vkb_midi/{Channel:0-16}/note/{Note:0-127} {Velocity:0-127}
