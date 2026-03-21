# Design System Specification: Mechanical Precision

## 1. Overview & Creative North Star
**Creative North Star: "The Tactical Overlord"**

This design system rejects the soft, bubbly aesthetic of consumer web apps in favor of a high-performance, hardware-integrated experience. It is inspired by the authoritative layouts of high-end motherboard BIOS interfaces, tactical HUDs, and premium PC monitoring software. 

The goal is to make the user feel like they are "plugged in" to the machine. We achieve this through **Mechanical Functionalism**: 
- **Intentional Asymmetry:** Avoid perfectly centered, "friendly" layouts. Use heavy left-alignment and offset data blocks to mimic diagnostic readouts.
- **Data-Density:** Embrace complexity. High-end users value information at a glance.
- **Hardware-Informed Geometry:** Utilize 0px radiuses and sharp 45-degree chamfers (simulated via CSS clips or borders) to evoke the feeling of machined aluminum and PCB traces.

---

## 2. Colors & Lighting
The palette is rooted in "Obsidian" depths, using high-contrast "Electric Cyan" to simulate active power states and hardware LEDs.

### Surface Hierarchy & Nesting
We do not use drop shadows to create depth; we use **Tonal Layering**. 
- **Base Layer:** `surface` (#0d0e10) is the "chassis."
- **Nesting:** To define a functional area (like a GPU monitor or a game library card), move to `surface_container` (#181a1c). For nested interactive elements, use `surface_container_high` (#1e2022).
- **The "Active State" Glow:** Use `primary` (#8ff5ff) sparingly. It is not a decorative color; it represents "Power On."

### The "No-Line" Rule
Traditional 1px solid borders for sectioning are strictly prohibited. Boundaries must be defined by:
1.  **Background Shifts:** Transitioning from `surface` to `surface_container_low`.
2.  **Subtle Grid Patterns:** Use a repeating 24px dot or line grid in `outline_variant` at 5% opacity to "texture" the background.

### Signature Textures
Apply a subtle linear gradient to main CTAs transitioning from `primary` (#8ff5ff) to `primary_container` (#00eefc) at a 135-degree angle. This simulates the directional light of a backlit mechanical keycap.

---

## 3. Typography
The system uses a dual-font approach to balance readability with a technical edge.

*   **Display & Headlines:** **Space Grotesk**. Its monospaced-adjacent character widths and technical apertures provide the "BIOS" feel.
    *   *Headline-LG:* 2rem. Use for section headers. All-caps with 0.05em letter spacing.
*   **Body & Titles:** **Poppins** (interpreted as 'Inter' in the tokens for maximum legibility).
    *   *Body-MD:* 0.875rem. The workhorse for all data and descriptions.
*   **Labels:** **Space Grotesk**.
    *   *Label-SM:* 0.6875rem. Used for metadata, tech specs, and "micro-copy" that feels like chassis serial numbers.

---

## 4. Elevation & Depth
In a mechanical interface, things don't "float"—they are "mounted."

*   **The Layering Principle:** Stack `surface-container-lowest` cards onto `surface-container-low` sections. The difference in hex value provides a crisp, machined edge without the "mushiness" of a shadow.
*   **The "Ghost Border" Fallback:** For interactive inputs, use a 1px border of `outline_variant` at 20% opacity. It should feel like a faint etching on a dark surface.
*   **Hardware Glow (Focus States):** Instead of a standard browser ring, use a `primary` outer glow with a blur of 4px and 0.4 opacity to simulate an LED emitting light onto the surface.

---

## 5. Components

### Buttons (The "Switch" Style)
*   **Primary:** Background `primary`, text `on_primary`. 0px border-radius. Use a 2px "power bar" on the left edge in a slightly brighter tint to indicate the button is "live."
*   **Secondary:** Ghost style. No background. Border `outline_variant` (20% opacity). Text `primary`.
*   **States:** On hover, the background should shift to `primary_dim` with a slight `primary` outer glow.

### Input Fields (The "Terminal" Style)
*   **Style:** Background `surface_container_highest`, 0px radius.
*   **Indicator:** A 2px bottom border using `primary` only when the field is focused.
*   **Label:** Always persistent, in `label-sm` (Space Grotesk), positioned top-left to look like a hardware label.

### Cards & Lists (The "Module" Style)
*   **Construction:** Strictly forbid divider lines. Use `spacing-4` (0.9rem) of vertical gap. 
*   **Visual Polish:** Add a "Technical Corner"—a small 4x4px square in the top-right corner of a card using `outline_variant` to mimic a mounting screw or alignment mark.

### Additional Component: The "Status Ribbon"
*   A thin, 4px tall horizontal bar used at the top of cards or sections. 
*   **Color-coded:** `primary` for "Online/Optimal," `error` for "High Temp/Critical," and `secondary_dim` for "Standby."

---

## 6. Do's and Don'ts

### Do:
*   **Use Monospace for Numbers:** Ensure all data (FPS, Temps, Pings) uses Space Grotesk to prevent layout jitter during updates.
*   **Embrace the Grid:** Align elements strictly to the 8px grid. If an element feels "off," it’s because it’s not snapping to the mechanical rail.
*   **High Contrast:** Keep text high-contrast (`on_surface` on `surface`). Avoid mid-grey text which looks "washed out" in gaming environments.

### Don't:
*   **No Rounded Corners:** Do not use `border-radius`. Everything must be 0px. Soft corners break the "hardware" illusion.
*   **No "Glassy" Blurs:** Avoid high-transparency glassmorphism. Surfaces should feel solid and opaque, like heavy-gauge plastic or metal.
*   **No Centered "Hero" Layouts:** Avoid the "Standard Startup" look. Offset your content to the left and use the right side for supplemental data or technical "glitch" textures.

---

## 7. Spacing Scale
Utilize the spacing scale to create "Information Clusters."
*   **Tight (Spacing 1-2):** For related technical data (e.g., "CPU Temp" and the value "65°C").
*   **Wide (Spacing 8-10):** To separate major hardware modules or functional zones.
*   **Gutter (Spacing 4):** Standard margin for all internal container padding.