---
title: "INCIDENT REPORT: Five Radios, One Cheap Display, Zero Free Pins (RE-CYD-2432S028)"
date: 2026-06-19
draft: false
tags: ["esp32", "bruce-firmware", "hardware-hacking", "cyd", "re-cyd", "pcb"]
series: ["RE-CYD"]
series_order: 1
showTableOfContents: true
summary: "Reworking a $15 Cheap Yellow Display to run the full Bruce Firmware module set: PN532, NRF24+PA/LNA, CC1101, RDM6300, and IR, plus the SD card ghost that nearly sent me down the wrong rabbit hole."
---

The Cheap Yellow Display (CYD) is everywhere in the ESP32 hacking scene right now: $15, a touchscreen, an SD slot, and just enough GPIO to make you think you can run [Bruce Firmware](https://github.com/BruceDevices/firmware)'s full module list on it. You can, sort of, one piece at a time. Bruce's own device compatibility table already lists the CYD-2432S028 as supporting CC1101, NRF24, FM radio, and PN532 individually. What it doesn't advertise up front is that several of those share the exact same pins in the stock config, so it's one radio or the other, never both, and there's no support at all for low-frequency RFID, an IR receiver, or any real power management. The board ships with barely enough free pins for the screen and SD card, let alone all of that running together.

So I gutted mine and rebuilt the board config from scratch. This is the V1 postmortem: the breadboard phase, the dumb soldering shortcut, the power collapse, and the bug that had me convinced my hardware was broken when it was actually a text file lying to me.

## Quick Reference: What Actually Broke

| Symptom | Root cause | Fix |
|---|---|---|
| Pin changes silently ignored after reflashing | Bruce writes its detected pin config to a file on the SD card at boot, and mirrors it into internal EEPROM/NVS, so stale config kept overriding new builds | Full chip erase (`pio run -t erase`) before every test flash during the dev phase |
| Radios fine on USB-C, flaky or undetected on battery | A 4.2V li-ion pouch under ~1.2 to 1.4A combined load sagged below what the modules and the CYD's onboard 3.3V regulator needed | Diagnosed in V1, actual fix (dedicated AMS1117 + FM5324HJ rails) lands in V2 |
| NRF24 and CC1101 randomly stomping on each other | Both radios cascaded off one shared physical SPI tap to save board space | Gave each radio its own dedicated SS/CE pin |

## What I Was Actually Trying to Cram In

The end goal for the "RE-CYD" (REworked CYD) was a CYD that could run every radio module Bruce Firmware supports, at the same time, on real external antennas, off a real battery:

- **PN532** for NFC/RFID at 13.56MHz
- **NRF24L01 with a PA/LNA front end** for 2.4GHz, long range
- **CC1101** for sub-GHz (315/433/868/915MHz depending on variant)
- **RDM6300** for 125kHz low-frequency RFID
- **IR LED + TSOP receiver** for infrared transmit/receive
- Dedicated power regulation, because none of the above run on hope alone

Stock, the CYD has none of this wired and nowhere near enough free GPIO to wire it. Every module above needed a home, and most of those homes were already occupied by the RGB LED, the backlight PWM line, or the SD card.

## The Problem: A GPIO Desert

Bruce's board configs live as `-D` build flags in `platformio.ini`, paired with a board-specific file under `boards/`. Pull up the stock CYD config and the pin budget tells the real story. The TFT eats the HSPI bus (MISO 12, MOSI 13, SCLK 14, CS 15, DC 2). The SD card sits on its own SPI bus (CS 5, SCK 18, MISO 19, MOSI 23). Touch takes pin 33. The RGB LED takes three more (the [stock pinout](https://randomnerdtutorials.com/esp32-cheap-yellow-display-cyd-pinout-esp32-2432s028r/) lists it as red on GPIO4, green on GPIO16, and blue on GPIO17), and the PWM backlight takes one (GPIO21).

The clearest sign there simply aren't enough pins to go around: in the stock Bruce config, CC1101 and NRF24 are mapped to the exact same SS and GDO0/CE pins. That's not an oversight, it's the firmware admitting you get one radio or the other, never both. And checking Bruce's own compatibility matrix, the RGB LED, a microphone, a speaker, and a fuel gauge are all marked unsupported on the CYD anyway, meaning desoldering that LED cost zero firmware features. It was just sitting there occupying pins the firmware wasn't using for anything.

## Reading the Board Before Cutting It
{{< figure src="/images/re-cyd-v1-pcbview.jpg" alt="RE-CYD V1 breadboard test bench" caption="PCB Reading via EASYEDA" >}}
CYD boards aren't one consistent product. Revisions drift, different touch controllers, different backlight wiring, even different antenna layouts under the same model number, and a written pinout guide only ever describes whichever revision its author happened to have on the bench. Before grinding a single pad or cutting a single trace, I found an older but accurate PCB layout for this exact revision on OSHWLab and opened it in EasyEDA to trace continuity myself: which pad actually connects to which GPIO, which traces shared a net with something I didn't want to disturb, and which cuts were genuinely safe versus which ones would take something else down with them. That file became the reference I trusted over any tutorial, because it was the actual board in my hands, not a similar-looking one.

## Step One: Free Real Estate

The first things to go were parts I knew I'd never miss. The RGB status LED got desoldered entirely (`RGB_LED=-1`). The PWM-driven backlight got hardwired to always-on instead of being dimmed through a control pin, which gave back the GPIO that used to handle brightness:

```ini
; stock CYD
-DBACKLIGHT=21
-DTFT_BL=21

; RE-CYD
-DBACKLIGHT=-1
-DTFT_BL=-1   ;disabled backlight [test]
```

Between the LED and the backlight, that was four extra GPIOs reclaimed. Not nearly enough on its own for five modules. The real win wasn't freeing individual pins, it was rethinking the bus.

While I was already in there cutting things I didn't need, the onboard audio amplifier chip and its supporting capacitors and resistor came off too. The CYD's speaker output is a constant idle draw I had zero use for on a radio-and-RFID tool, and removing it freed GPIO26 as a side effect. I'm not using that pin in this revision, it's just sitting reserved for something in V2.

## Step Two: Vampirizing the SD Card's SPI Bus
{{< figure src="/images/re-cyd-v1-SPI-Vampire.png" alt="SD Reader SPI lines Hijacking" caption="SD Reader SPI lines Hijacking" >}}
The SD card already had a perfectly good SPI bus (SCK 18, MISO 19, MOSI 23) that nothing else was using. Rather than scavenging three fresh lines per module, I shared that bus across PN532, NRF24, and CC1101, and gave each one its own dedicated chip-select pulled from the pins freed by the RGB LED removal and the unused CN1 connector pads. Worth noticing if you check the stock pinout against my board file: the RGB LED's red, green, and blue lines were GPIO4, 16, and 17. Those are exactly the pins that became NRF24's CE, CC1101's GDO0, and NRF24's SS. The LED wasn't just in the way, it was sitting on precisely the right pins.

| Function | Stock CYD pin | RE-CYD pin | Note |
|---|---|---|---|
| CC1101 SS / GDO0 | 27 / 22 (shared with NRF24) | 22 / 16 | own dedicated lines |
| NRF24 CE / SS | 22 / 27 (shared with CC1101) | 4 / 17 | own dedicated lines |
| PN532 SS | not present | 27 | repurposed grove/I2C pin |
| RDM6300 RX | not present | 35 | input-only pin, fine for a receive-only line |
| IR TX / RX | 22, 27 / 22, 27, 35 (shared with everything) | 21 / 34 | TX drives the LED; RX is the LDR's old input-only pin, now feeding the TSOP receiver |
| SPI bus (SCK/MOSI/MISO) | SD card only | SD card + PN532 + NRF24 + CC1101 | shared bus, separate CS per device |

Not every freed-looking pin could do this job, though. GPIO34, 35, 36, and 39 on the ESP32 are input-only: no internal pull resistors, and the chip simply will not drive them as outputs no matter what the firmware asks for. The [CYD pinout reference](https://randomnerdtutorials.com/esp32-cheap-yellow-display-cyd-pinout-esp32-2432s028r/) flags GPIO35 for exactly this, and the same restriction covers the onboard light sensor's pin (GPIO34) and the touch controller's pins (36, 39). That ruled those four out for anything that needs to drive a line: a chip select, a CE, an IR LED. It did not rule them out for anything that only listens. GPIO34 used to read the CYD's onboard LDR next to the screen. I desoldered that LDR and ran the TSOP IR receiver's output into the same pad instead, since both jobs are pure inputs, the pin's role didn't need to change, just what was listening on it. GPIO35 picked up the RDM6300's RX line for the same reason: it only ever receives tag data, it never has to drive anything.

```ini
-DSPI_SCK_PIN=18      ; shared with SD card
-DSPI_MOSI_PIN=23     ; shared with SD card
-DSPI_MISO_PIN=19     ; shared with SD card

-DCC1101_SS_PIN=22
-DCC1101_GDO0_PIN=16
-DNRF24_SS_PIN=17
-DNRF24_CE_PIN=4
-DSPI_SS_PIN=27       ; PN532 chip select
```

Three radios, one bus, three CS lines. The SD card stayed on the same physical wires and kept working without a hiccup. SPI doesn't care how many devices are listening as long as exactly one is selected at a time, the chip-select line is what enforces that, not the data lines.

{{< mermaid >}}
graph LR
  ESP[ESP32]
  BUS["Shared SPI bus<br/>SCK 18 / MOSI 23 / MISO 19"]
  ESP --> BUS
  BUS --> SD["SD Card<br/> CS 5"]
  BUS --> PN["PN532<br/> CS 27"]
  BUS --> CC["CC1101<br/> CS 22, GDO0 16"]
  BUS --> NRF["NRF24<br/> CS 17, CE 4"]
{{< /mermaid >}}

## The Dumb Idea (Filed Under: Fun While It Lasted)

Before settling on separate CS lines for everything, I tried something genuinely dumber: physically cascading the NRF24 and CC1101 off each other's original header pins, sharing a single physical SPI tap instead of running individual lines, purely to save board space.

It worked. That's almost the problem. I spent real soldering time on a setup that looked clever and ran two radios off effectively one shared tap with no proper per-device CS arbitration. The result was exactly what you'd expect from two SPI devices fighting over a line that wasn't cleanly gated between them: random cross-interference, one radio's transaction occasionally stomping on the other's, intermittent and miserable to debug. Fun technical performance of soldering, bad architecture. I tore it out and gave both radios their own CS pin, which is the table above.

## Validation: Build It Boring First

The very first test wasn't even about a radio module, it was about trusting the process at all. I rerouted the IR LED's TX pin to the RGB LED's green line (GPIO16, already free at that point), reflashed, and ran a TV-B-Gone attack. Watching that LED flicker through the TV-B-Gone code sequence was the proof I needed: Bruce was actually picking up my board file's pin remap instead of silently falling back to a default. Small test, but it set the tone for the rest of the build. Don't assume a pin change worked, watch it work.

I didn't wire five modules at once and hope for the best. Each one got tested solo first: wire it in, remap its pins in `platformio.ini`, compile, flash, confirm the firmware actually responds to the new pin assignment rather than falling back to a default. That phase doubled as training on how Bruce's board-config system expects pins to be declared, which paid off later when I needed to debug pin behavior under pressure.

Once every module worked individually, I "table tested" all of them together on the open bench, no case, no battery, just USB-C power and patience. That all-together test passed clean. Only after that did I commit to a 3D-printed V1 case and start wiring it for real use, adding one more module at each step rather than all five in one pass, so any new instability had exactly one suspect.

## The Ghost in the SD Card

This is the bug that actually cost time. Bruce Firmware writes its detected pin configuration out to a file on the SD card at boot. Change a pin definition in `platformio.ini`, recompile, reflash, and the firmware kept behaving like the old configuration was still active.

I assumed it was my hardware mod or my code. I went back over solder joints that were fine. I re-checked pin definitions that were correct. Pulling the SD card out entirely seemed like the obvious next move, and it didn't fix anything either, because the exact same configuration gets mirrored into the ESP32's internal EEPROM/NVS, so the stale values just got rehydrated from internal flash instead of from the card.

The actual fix was blunt: full chip erase before every test flash, no exceptions, for the rest of the dev phase.

{{< alert >}}
Full chip erase wipes everything on the ESP32, not just the stale pin config. Any WiFi credentials, saved settings, or files Bruce had written to internal flash go with it. Worth it during active dev, not something to casually run on a daily-driver build.
{{< /alert >}}

```bash
pio run -t erase
# or, directly:
use platformio addon on VSCode opening the forked or original repo

```

Once that became routine instead of an afterthought, iteration sped up immediately. No more chasing a configuration that was three flashes stale.

## Power: The Part That Actually Broke V1

Everything ran flawlessly on USB-C power straight into the CYD. On battery, an old smartphone lithium pouch with no dedicated regulator or boost converter in V1, it fell apart: modules dropping out, NFC reads going intermittent, radios going unresponsive mid-session with no obvious pattern.

A USB power meter on the input rail told the real story: roughly 0.8A at idle with modules powered but unused, climbing to 1.2 to 1.4A under active use across the radios. A lithium cell at a fully charged 4.2V was never going to comfortably supply a 5V rail that both the board and the modules expected, especially once that cell starts sagging under load the way small pouch cells do at anything above a modest discharge rate. Making it worse, V1 was feeding the radio modules' 3.3V rail off the CYD's own onboard regulator, the same one meant only for the display and ESP32, not five additional power-hungry modules layered on top.

V1's job here was diagnosis, not the fix. Confirming the actual current draw, confirming the battery rail was the failure point and not a bad solder joint or a misconfigured pin, and confirming the stock onboard regulator was undersized for the new load. The real fix, a dedicated AMS1117 3.3V rail isolated for the radio modules and a FM5324HJ-based charger/regulator capable of a clean 5V at 2A from the lithium pouch, is V2's problem and gets its own article.

## Antennas: No Coffee, Steady Hands

Every radio module shipped with a stock SMA connector. I wanted external antennas on all of them, including the CYD's own onboard ESP32 for WiFi, NRF24, and CC1101, which meant swapping every SMA footprint for IPX1 and, for the onboard antenna specifically, redirecting the ESP32's RF path from its PCB trace antenna to an external one.

That's fine surgery: grinding existing pads clean, tinning precisely, and getting an IPX1 connector soldered strongly enough to survive a pigtail SMA being plugged and unplugged repeatedly without lifting the pad. I didn't drink coffee for 24 hours before doing this specifically to keep my hands steady through it, and every connector held under stress testing afterward.

{{< figure src="/images/nrf-ipx1.png" alt="NRF24 IPX1 Conversion" caption="NRF24 PA/LNA conversion from SMA to IPX1" >}}

## GPS: Already on the Chopping Block

V1 also carries a GPS module, wired straight into the existing TX/RX pins (GPIO3 TX, GPIO1 RX) that Bruce already reserves for serial and GPS use. No remapping, no pins to fight for, easiest module on the whole build by far. It's also not making the cut for V2. The antenna footprint is bulkier than I want on a board already cramming five radios and a touchscreen into a small case, and I don't have an actual use case for location data on this particular tool. Sometimes the right call isn't a clever pin trick, it's just admitting a feature doesn't earn its space.

{{< figure src="/images/re-cyd-v1.jpg" alt="RE-CYD V1 breadboard end result" caption="full V1 on-box mounted and working, but not satisfying lol" >}}

## Takeaways


- Test every module solo before combining anything. It's slower upfront and saves you from debugging five problems simultaneously later.
- If a multi-tool firmware persists configuration anywhere (SD card, EEPROM, NVS), assume stale state before you assume broken hardware. Full chip erase before every test flash during active dev.
- Sharing an SPI data bus across modules is fine. Sharing a physical chip-select or control line between two active devices is not. Give every device its own CS.
- "Works on USB power" proves nothing about "works on battery power." Measure actual current draw before trusting a battery rail to deliver it.
- A clever solder job that technically works isn't automatically a good architecture decision.
- Free real estate before you go hunting for it: parts you don't need (RGB LEDs, unused PWM lines) are often cheaper to remove than new pins are to find.
- If a written pinout guide might not match your board's actual revision, pull the real PCB file (OSHWLab, EasyEDA, whatever exists) and trace continuity yourself before cutting or grinding anything.
- Know which GPIOs are input-only before planning a pin map. Reserve those for receive-only signals (sensor inputs, UART RX, IR receivers), not for anything that needs to drive a chip select or enable line.

V2, the proper PCB with onboard power regulation for all five modules, is next.

## References

- My fork with the RE-CYD board config (firmware only for now, hardware files coming with the V2 writeup):

{{< github repo="crashlogs/Bruce-Re-CYD" showThumbnail=true >}}

- [Bruce Firmware](https://github.com/BruceDevices/firmware), the open-source ESP32 multitool this whole project is built on top of
- [Bruce Wiki](https://wiki.bruce.computer/), for module-by-module feature and pin documentation
- [ESP32 Cheap Yellow Display (CYD) Pinout](https://randomnerdtutorials.com/esp32-cheap-yellow-display-cyd-pinout-esp32-2432s028r/) by Random Nerd Tutorials, the reference I cross-checked stock pin assignments against
