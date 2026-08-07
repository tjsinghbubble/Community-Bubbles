# Context

These are rough notes generated after a Replit-incurred outage

# Quick Health Diagnosis

Use `curl` for a fast two-part diagnosis. 

Code	Meaning
0			Success
60		SSL cert problem (untrusted/self-signed/broken chain)
51		(older curl) SSL peer certificate or SSH remote key was not OK
35		SSL connect error (handshake failure, protocol mismatch)
28		Operation timeout
7			Failed to connect (DNS/connection refused)
6			Couldn't resolve host



# Existing Monitors

## Sentry 

## UptimeRobot

I created a monitor on UR using their free tier.  this won't be visible to you, since i logged in with GitHub, but we could set this up more generally.

https://dashboard.uptimerobot.com/monitors

