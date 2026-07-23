# iPhone shell scaffold

The PWA remains the live iPhone product. This folder intentionally does not
contain a generated Xcode project, signing configuration, TestFlight setup, or
Apple credentials.

When an Apple Developer membership is intentionally available, install
Capacitor locally, run the web production build, add the iOS platform, and set
the production redirect URL in both Supabase and Plaid. Keep the redirect URL
on the HTTPS app origin; the app must return through the same shared React
authentication flow. Verify universal links/deep links on a physical device
before enabling any distribution channel.
