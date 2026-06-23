/**
 * Analytics tracking utilities for builder blocks
 */

interface TrackEventParams {
  profileId: string;
  blockId: string;
  eventType: string;
  metadata?: Record<string, any>;
}

/**
 * Track a block interaction event
 */
export async function trackBlockEvent({
  profileId,
  blockId,
  eventType,
  metadata,
}: TrackEventParams) {
  try {
    // Use sendBeacon for better reliability and non-blocking behavior
    const data = JSON.stringify({
      profileId,
      blockId,
      eventType,
      metadata,
    });

    if (navigator.sendBeacon) {
      const blob = new Blob([data], { type: "application/json" });
      navigator.sendBeacon("/api/connect/block-analytics", blob);
    } else {
      // Fallback to fetch
      fetch("/api/connect/block-analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data,
        keepalive: true,
      }).catch(() => {
        // Silently fail - don't disrupt user experience
      });
    }
  } catch (error) {
    // Silently fail - analytics shouldn't impact user experience
    console.debug("Track event failed:", error);
  }
}
