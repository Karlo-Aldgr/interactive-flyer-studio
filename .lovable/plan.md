Plan:

1. Update `src/pages/PublicViewer.tsx` intro-audio fallback:
   - Stop using muted autoplay as the mobile fallback.
   - If unmuted autoplay is blocked, reset `currentTime` to `0`, keep the audio paused, and show the existing start/unmute prompt.
   - Do not mark the intro as played until audible playback actually starts.

2. Make the first user tap start the intro audio from the beginning:
   - Replace the global “unmute while already playing” handlers with a single gesture handler that sets `currentTime = 0`, unmutes, and calls `play()` directly inside the tap/click event.
   - Keep the prompt hidden after successful playback and show the mini-player only when audible audio is playing.

3. Update the prompt text from “Tap to unmute” to a clearer start-audio label, because on mobile the audio will no longer be secretly playing muted in the background.

Technical details:
- This avoids the browser behavior you’re seeing: the audio timeline starts muted on page load, then becomes audible mid-track after a tap.
- Mobile browsers still require a user gesture for audible audio, but the first tap will now start from `0:00` instead of unmuting halfway through.