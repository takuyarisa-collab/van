# van UI Design v2

## Purpose

This document defines the next visual direction for the van Boot / Home UI.

The previous implementation phase prioritized lightweight code-first prototyping. That was useful for proving the Boot → collapse → PLAY formation → repair processing → Home flow, but the current expression now risks looking like a compromised lightweight implementation rather than an intentional art direction.

From this point forward, UI work should be judged by whether it moves the game toward a modern, material-rich presentation rather than by how many small glitch effects are added.

## Core direction

van UI v2 should read as:

> A damaged operating surface that was reconstructed by the system, not a decorative glitch UI.

The UI is not clean. It is also not cheap by default.
It should feel like a premium interface whose structure was broken, reassembled, and left partially unstable.

## What to avoid

Avoid relying on these as the primary visual language:

- Generic scanlines
- Random noise
- Thin 1px debug-like strokes
- Decorative cracks without structural meaning
- Small dust particles as a substitute for material detail
- Constant blinking or flickering
- Overly flat Phaser Graphics shapes
- Effects that look like placeholders for future art

These elements may still be used, but only as secondary accents.

## Modern visual principles

### 1. Material first

UI parts should be built from layers that imply material:

- Translucent glass surface
- Subtle internal shadow
- Edge thickness
- Uneven repaired border
- Light catch / soft reflection
- Surface scratches or compression marks
- Slight depth separation from the background

The important shift is:

> Do not draw a button. Build a damaged surface that functions as a button.

### 2. Fewer effects, stronger hierarchy

The UI should not become busy.
A modern look comes from controlled hierarchy:

1. Background atmosphere
2. Reconstructed UI surface
3. Functional text
4. Damage / repair marks
5. Momentary system correction effects

Effects should support this hierarchy, not compete with it.

### 3. Damage must be structural

Damage should explain how the UI is held together.
Good damage examples:

- One edge is slightly misaligned
- A panel corner is missing or compressed
- Two fragments overlap with a visible seam
- A repair seam crosses only a meaningful joint
- The surface is usable but not fully restored

Weak damage examples:

- Random cracks anywhere
- Random pixel noise
- Decorative scratches with no relation to the shape
- Glitch overlays that do not affect structure

### 4. Repair should feel like fixation, not scanning

The PLAY repair phase should not be mainly a scanline animation.
It should read as a short emergency fixation step.

Preferred repair cues:

- A surface locks into place with a small non-elastic snap
- 2-3 seam points briefly activate
- Edges clamp inward by a few pixels
- A repaired seam remains visible after the effect
- The final shape keeps small asymmetry

Avoid making the repair phase feel like a generic system scan.

### 5. Glitch is an event, not the default texture

Glitch should appear when the system fails, transitions, or corrects itself.
The stable Home state should be quiet.

This makes glitch moments more valuable and prevents the UI from feeling noisy or old-fashioned.

## PLAY button direction

The PLAY element is the first priority.

It should become a reconstructed surface with:

- A large, tactile panel-like base
- Subtle glass / acrylic material quality
- Damaged but deliberate outer contour
- Broken fragment seams that align with the collapse history
- Minimal emergency repair markers
- PLAY text that feels embedded into the repaired surface, not floating above it

The desired impression is:

> It should look like the system managed to restore only the minimum viable PLAY interface.

Not:

> A normal button with glitch effects on top.

## Home UI direction after PLAY

After PLAY is established, `/CONF`, `/VIEW`, and `/DATA` should inherit the same material language.

They should not simply copy PLAY at smaller size.
Instead:

- PLAY is the main recovered control
- Sub buttons are lower-priority recovered modules
- Their surfaces may be thinner, dimmer, or less complete
- Their damage should be quieter
- Their layout should suggest a damaged OS menu rather than a normal game menu

## Implementation policy

### Prefer reusable visual layers

Future code should move toward reusable UI layer helpers rather than one-off Graphics effects.

Useful layer concepts:

- base surface
- inner shadow
- edge highlight
- repaired seam
- damage mask
- reflection band
- text embed layer
- one-shot correction flash

### Use Phaser Graphics carefully

Phaser Graphics is acceptable, but it should not dominate the final look.
Use it for masks, seams, subtle overlays, and debug helpers.
For premium surfaces, prefer layered images, generated textures, or reusable RenderTexture-style composition where practical.

### Mobile performance remains important

Modern does not mean heavy.
The goal is a richer composition, not expensive effects.

Good mobile-friendly techniques:

- Pre-generated textures
- Small number of layered sprites
- Static or low-frequency overlays
- Short transition effects only
- Avoid continuous full-screen distortion unless intentionally profiled

## Next implementation target

The next PLAY pass should be:

> Replace the current repair-processing-heavy look with a reconstructed material surface pass.

Initial scope:

- Reduce scanline dominance
- Add material surface layers
- Add intentional repaired seams
- Keep final asymmetry
- Make PLAY text feel embedded
- Preserve the existing Boot → Home flow

Do not redesign the whole Home screen yet.
PLAY becomes the visual reference first.
