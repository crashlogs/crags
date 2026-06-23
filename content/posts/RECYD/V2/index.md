---
title: "RE-CYD: Version 2, Trading Cable Spaghetti for a Real PCB (RE-CYD-2432S028)"
date: 2026-06-22
draft: false
tags: ["esp32", "bruce-firmware", "hardware-hacking", "cyd", "re-cyd", "pcb", "power-electronics"]
series: ["RE-CYD"]
series_order: 2
showTableOfContents: true
summary: "V1 of the RE-CYD proved five radios could share one CYD. V2 replaces the rat's nest of wires that held it together with a real PCB, fixes the power problems for good, and turns up an unexpected compatibility angle with another CYD firmware project."
---
{{< figure src="/images/V2-cover.jpg" alt="RE-CYD Featured" >}}
[V1 of the RE-CYD](/posts/re-cyd-incident-report-v1/) proved the concept: five radio modules, one Cheap Yellow Display, all running at once. It also proved that loose wires are not a wiring method, they're a bug generator. Every cable was a chance for a cold joint, a flex fracture, or a connector that looked seated but wasn't. V2's whole job was to make that mess disappear into a board.

## Quick Reference: What V2 Actually Hit

| Symptom | Root cause | Fix |
|---|---|---|
| TSOP IR receiver dead on the first homemade prototype | scavenged TSOP units have no reliable pinout reference, pads were wired reversed | caught on the homemade board before committing to the real PCB, footprint corrected |
| Case nearly impossible to reflash without disassembly | reset/boot buttons never broken out from the CYD to the new PCB | known gap, queued for V3 |
| Tight, fiddly fit closing the V2 shell | board and module stack got thicker than the shrunk footprint comfortably allows | acceptable for now, more clearance planned for V3 |

## What Actually Changed From V1

V1 was a breadboard's worth of point-to-point wiring crammed into a case. V2 replaces nearly all of it with a single PCB that holds every module in a fixed position, with only short bridge wires running from the CYD's broken-out pins to the board itself. Alongside that:

- Proper decoupling capacitors at every radio module's power pins, not just at the regulators
- A dedicated power section: AMS1117 for a clean 3.3V radio rail, FM5324 for 5V/2A charging and boost from the lithium pouch, plus a momentary on/off switch
- A new, much smaller 3D-printed case
- GPS dropped entirely, for the same reasons covered in V1: bulky antenna, no real use case on this build

{{< mermaid >}}
graph LR
  CYD["CYD ESP32 + Screen"] -->|bridge wires| PCB["RE-CYD V2 PCB"]
  PCB --> PN["PN532"]
  PCB --> NRF["NRF24"]
  PCB --> CC["CC1101"]
  PCB --> RDM["RDM6300"]
  PCB --> TSOP["TSOP IR receiver"]
  PCB --> PWR["AMS1117 + FM5324 power section"]
{{< /mermaid >}}

## Designing Around Mismatched Footprints

Every module on this build, PN532, NRF24, CC1101, RDM6300, TSOP, is itself a small breakout PCB with its own pin spacing, not a bare component I could drop anywhere on a layout. Most of them are well-documented parts, I could find proper dimensional drawings for PN532, NRF24, CC1101, and RDM6300, and still went back for a second measurement pass before committing anything to copper. Measure twice, cut once applies just as much to PCB footprints as it does to wood.

The TSOP IR receiver and the IR LED were the exceptions. Both came from scavenged stock with no trustworthy pinout reference to check against, so those two needed verification by trial rather than confirmation against a datasheet. The V2 PCB still needed a header footprint for every module and a layout that let the shared bus and power rails cascade out to all of them without the boards physically colliding, that spacing and footprint work, more than the trace routing itself, is most of what "designing this PCB" actually meant.

{{< figure src="/images/layout.png" alt="RE-CYD V2 PCB layout showing module footprint placement" caption=" working out where five non-standard breakout boards could physically sit without colliding" >}}

{{< alert >}}
Most parts here had real documentation, that's not a reason to skip double-checking dimensions before committing a footprint. The two parts that didn't (TSOP, IR LED) are exactly where the surprises happened, verify those by continuity testing rather than trusting silkscreen or a stock photo.
{{< /alert >}}

## Prototype First: The Homemade PCB Catches a Reversed TSOP

Before committing to a real fabrication run, I etched a homemade PCB to verify footprints and trace continuity. It caught exactly the kind of bug the alert above is warning about: the TSOP IR receiver's pads were wired reversed. With no trustworthy pinout reference for that scavenged part, I had to test pin assignment by trial rather than assume it from a datasheet. The homemade board also doubled as a physical mockup for module spacing, since fitting five non-standard breakout boards onto one layout is as much a geometry problem as an electrical one.

{{< figure src="/images/re-cyd-v2-1-places.jpg" alt="Homemade RE-CYD V2 prototype PCB with modules under test" caption=" the homemade prototype board where the reversed TSOP footprint got caught before the real fab run" >}}

## Going Pro (Sort Of)

With the homemade board validated and the TSOP fix folded in, the design went to a local PCB shop for proper fabrication. It came back medium quality, but more than good enough for a prototype run, and every fix from the homemade version made it into that board cleanly. I'm not naming the shop here, it served its purpose for this stage but isn't what I'd recommend for a production-quality board. V3 is moving to JLCPCB for that.

{{< figure src="/images/re-cyd-v2-PCB-old-new.jpg" alt="Professionally fabricated RE-CYD V2 PCB populated with all modules" caption=" the pro-fab V2 board with every module mounted, sitting in the open V2 case" >}}

## Power: Boring This Time, Which Is the Point

V1 spent real time diagnosing why everything worked on USB-C and fell apart on battery. V2's job was just confirming the fix actually held. Every radio module gets its own local decoupling now: a 4.7uF, a 100nF, and a 10uF SMD capacitor stacked within less than a centimeter of each module's power pins. A 47uF capacitor sits near the AMS1117's output for the radio rail, and another near the FM5324, which handles the lithium pouch's charging, the 5V/2A boost, and the momentary on/off switch in one section of the board.

It worked. Current draw is healthy, the instability from V1 is gone, and nothing needed a second pass to get there, the FM5324-based power section did exactly what diagnosing V1's problem said it should do.

{{< figure src="/images/re-cyd-v2-step-up.jpg" alt="Close-up of the V2 power section with decoupling capacitors, AMS1117, and FM5324" caption=" the power section: AMS1117 radio rail, FM5324 charge/boost/switch, and decoupling caps tucked in close to each module" >}}

## The Case: Same Board, Much Smaller Footprint

| Dimension | V1 | V2 |
|---|---|---|
| Length | 160mm | 97.6mm |
| Width | 83mm | 76.6mm |
| Thickness | 20mm | 28.09mm |

The footprint (length times width) dropped from roughly 13,280mm² to about 7,476mm², a cut of around 44%. Thickness actually grew by about 40%, since the PCB and module stack now sits taller than V1's loose-wired layout did. Even with that trade, total enclosed volume still came down by roughly 21%. Smaller to hold, smaller to pocket, and noticeably more rigid than V1's wobble ever was.

{{< figure src="/images/compare.png" alt="Fully assembled and closed RE-CYD V2 unit" caption=" V2 closed up and running" >}}

## What's Already Queued for V3

V1 got fully torn down to build V2, every module and most of the wiring got reused. V2 is staying intact this time, I like this revision enough to keep it running rather than cannibalize it, which means V3 starts from fresh components rather than salvage.

Two specific things are already on that list:

- **Reset and boot buttons** are still sitting on the original CYD, never broken out to the new PCB. Reflashing means partially disassembling the case to reach them, which gets old fast during active development.
- **Case clearance**: V2 closes with screws, but the shell is a genuinely tight fit getting everything seated. It works, but "tight" isn't a long-term assembly strategy.
- **RDM6300 antenna placement**: it works in V2's shell, but not in a spot I'm happy with long-term. V3 gets a better location for it.
- **Battery status without burning a CYD pin**: V2 doesn't show battery level on the firmware UI, the FM5324 already has its own status LEDs for charge state, and V3 will route those out to the shell instead of dedicating another CYD pin to a battery indicator I don't actually need duplicated in software.

## Beyond Bruce: Could This Run Other Firmware?

An Instagram maker, [@0sens3](https://www.instagram.com/0sens3/), pointed out something I hadn't considered: the RE-CYD hardware itself, not just the Bruce board config, might suit other CYD-based firmware projects entirely. I haven't tested this myself yet, but a quick look at [HaleHound-CYD](https://github.com/JesseCHale/HaleHound-CYD), another multi-protocol toolkit for the same CYD hardware, turned up more overlap than I expected.

{{< github repo="JesseCHale/HaleHound-CYD" showThumbnail=true >}}

HaleHound's own wiring documentation reuses the RGB LED's freed pins (GPIO4, 16, 17) for the NRF24's CE, CSN, and IRQ lines, the same pool of pins RE-CYD pulls NRF24's control lines from. It also shares the SD card's VSPI bus (GPIO18/19/23) across its external radios with per-device chip select, exactly the bus-sharing approach covered in the V1 article. Most notably, HaleHound's own documentation warns that PA-equipped radio modules draw too much current for the CYD's onboard 3.3V regulator and need an independent buck converter, the exact failure mode V1 diagnosed and V2's dedicated AMS1117 rail solves. It even recommends a bulk capacitor at the NRF24 to stop random resets, the same instinct behind V2's per-module decoupling.

None of that is proof the RE-CYD board will run HaleHound out of the box. It's evidence that two independent projects on the same hardware kept converging on the same fixes, which is a good sign for compatibility, not a guarantee of it. If you build one of these and try another firmware on it, I'd genuinely like to know how it goes.

## Takeaways

- A rat's nest of wires isn't just ugly, it's an unbounded source of intermittent bugs. Consolidating onto a PCB removes variables you didn't know you were debugging.
- Most parts having real documentation isn't a reason to skip double-checking dimensions, measure twice, cut once still applies to PCB footprints. The parts that genuinely lack documentation (here, the TSOP and the IR LED) are where you actually need continuity testing, not silkscreen guesswork.
- A homemade prototype board earns its time even when you already plan to go pro. It's cheaper to catch a reversed footprint there than after a paid fab run.
- A correctly diagnosed power problem should produce a boring fix. If V2 needed another round of power debugging, that would have meant V1's diagnosis was wrong.
- Smaller footprint and smaller overall volume aren't the same trade. Check both before calling a redesign a win.
- If two unrelated projects independently converge on the same pin choices and the same power fix for the same board, that's real signal about the hardware, even before you've tested the overlap yourself.

V3 starts from fresh components, with the reset/boot buttons and case clearance both already on the list.

## Ressources

- My repo, modified with the RE-CYD board pins definitions firmware in the root

{{< github repo="crashlogs/Bruce-Re-CYD" showThumbnail=true >}}
- V2 PCB ressources here 

{{< github repo="crashlogs/RE-CYD" showThumbnail=true >}}

## References

- [Bruce Firmware](https://github.com/BruceDevices/firmware), the open-source ESP32 multitool this whole project is built on top of
- [HaleHound-CYD](https://github.com/JesseCHale/HaleHound-CYD), the other CYD firmware project with the unexpected hardware overlap
- [MACSBUG BLOG](https://macsbug.wordpress.com), where I got pinout and precious initial informations