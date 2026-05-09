## What I found

The flyer is loading and the audio is already playing, but on mobile the interactive canvas controls are unreliable:

- The yellow **subscribe** button is drawn inside Konva, but tapping it is likely being blocked by the separate highlight canvas layer sitting above the content.
- The red air-message bubble has an action, but it is rendered inside the same Konva stage and needs more reliable mobile tap handling.
- The hover/highlight behavior is currently disabled for the red/yellow areas because their action highlight style is set to `none`, so there is no visible hover/tap cue.
- The audio prompt should not stay visible as “tap to start/unmute” once the audio is already playing.

## Plan

1. **Fix touch/click events in the public flyer viewer**
   - Change the highlight overlay layer so it cannot sit above and steal mobile taps.
   - Keep highlights visible but render them behind or non-blocking relative to clickable content.
   - Make all actionable Konva groups explicitly interactive with `listening`, `onClick`, `onTap`, and pointer/touch handlers.

2. **Make subscribe button taps reliable**
   - Ensure button actions fire from the whole button group, not only from its background rect.
   - Add a transparent hit rectangle if needed so the full button area is tappable on mobile.
   - Verify tapping the yellow subscribe button opens the subscribe dialog.

3. **Make red air-message bubble taps reliable**
   - Add a full-size hit area to each air-message bubble so the entire bubble responds to taps.
   - Ensure nested bubble actions call `executeAction`, including subscribe actions.
   - Verify the red bubble opens its subscribe flow.

4. **Restore visible hover/tap indication**
   - If an action has `highlight.style: none`, don’t show a pulsing border, but still allow a subtle mobile-friendly active/hover cursor state.
   - Add pointer cursor for actionable layers on desktop and tap feedback on mobile.

5. **Remove the lingering audio prompt**
   - Hide the “tap to unmute/start” prompt whenever audio is already playing.
   - Keep the mini-player only, so users see **Now playing / Stop** without a confusing extra tap prompt.

6. **Validate on mobile viewport**
   - Open the published flyer route at mobile size.
   - Test: audio prompt gone, yellow subscribe opens dialog, red bubble opens subscribe/action, and interactive regions show a cue.
