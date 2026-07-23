# Future iPhone build path

TwinPath ships as a PWA today. `capacitor.config.json` reserves a shared React
web bundle for a future native shell without changing login, offline caching,
or financial connector behavior.

Manual future path (not enabled by this repository):

1. Install Capacitor tooling locally and run `npm run build`.
2. Add and open the iOS platform from a Mac with Xcode.
3. Configure the `com.twinpath.app` bundle identifier, app-associated domain,
   Supabase redirect URL, and Plaid redirect URL for the production HTTPS app.
4. Test password and magic-link sign-in, Plaid OAuth return, offline labels,
   private mode, safe areas, and reduced motion on an iPhone.
5. Add signing and TestFlight/App Store distribution only after intentionally
   purchasing Apple Developer membership.

Codemagic cloud builds and TestFlight publishing are deliberately not
configured.
